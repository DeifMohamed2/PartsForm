// =============================================================================
// TURBO TRANSFORM v2.0 — Rust CSV→NDJSON+BULK Engine
// =============================================================================
// Zero-copy streaming CSV parser with file-level parallelism.
// Designed for 75M+ records on multi-core servers.
//
// v2.0: DUAL OUTPUT per CSV file:
//   - .ndjson  → for mongoimport (one JSON doc per line)
//   - .bulk    → pre-formatted ES _bulk API body (action+doc pairs)
//
// Architecture:
//   1. Enumerate CSV files in input directory
//   2. rayon parallel iterator: one thread per file
//   3. Each thread: BufReader → csv::Reader → serde serialize → 2× BufWriter
//   4. Machine-readable JSON progress on stderr, final summary on stdout
//   5. Exit 0 on success, 1 on failure
// =============================================================================

use csv::ReaderBuilder;
use rayon::prelude::*;
use serde::Serialize;
use std::env;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

// =============================================================================
// Output record for NDJSON (MongoDB) — all fields
// Matches the exact schema the Node.js turboSyncEngine produces.
// =============================================================================
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PartRecord<'a> {
    part_number: &'a str,
    description: &'a str,
    brand: &'a str,
    supplier: &'a str,
    price: f64,
    currency: &'a str,
    quantity: i64,
    min_order_qty: i64,
    stock: &'a str,
    stock_code: &'a str,
    weight: f64,
    weight_unit: &'a str,
    volume: f64,
    delivery_days: i64,
    category: &'a str,
    subcategory: &'a str,
    integration: &'a str,
    integration_name: &'a str,
    file_name: &'a str,
    imported_at: &'a str,
}

// =============================================================================
// Output record for ES _bulk — same fields minus imported_at
// =============================================================================
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PartRecordES<'a> {
    part_number: &'a str,
    description: &'a str,
    brand: &'a str,
    supplier: &'a str,
    price: f64,
    currency: &'a str,
    quantity: i64,
    min_order_qty: i64,
    stock: &'a str,
    stock_code: &'a str,
    weight: f64,
    weight_unit: &'a str,
    volume: f64,
    delivery_days: i64,
    category: &'a str,
    subcategory: &'a str,
    integration: &'a str,
    integration_name: &'a str,
    file_name: &'a str,
}

// =============================================================================
// Column mapping — resolved once per file from header row
// =============================================================================
struct ColumnMap {
    part_number: Option<usize>,
    description: Option<usize>,
    brand: Option<usize>,
    supplier: Option<usize>,
    price: Option<usize>,
    currency: Option<usize>,
    quantity: Option<usize>,
    min_order_qty: Option<usize>,
    stock: Option<usize>,
    stock_code: Option<usize>,
    weight: Option<usize>,
    weight_unit: Option<usize>,
    volume: Option<usize>,
    delivery_days: Option<usize>,
    category: Option<usize>,
    subcategory: Option<usize>,
}

impl ColumnMap {
    fn from_headers(headers: &csv::StringRecord) -> Self {
        let mut map = ColumnMap {
            part_number: None,
            description: None,
            brand: None,
            supplier: None,
            price: None,
            currency: None,
            quantity: None,
            min_order_qty: None,
            stock: None,
            stock_code: None,
            weight: None,
            weight_unit: None,
            volume: None,
            delivery_days: None,
            category: None,
            subcategory: None,
        };

        for (i, h) in headers.iter().enumerate() {
            let h_lower = h.trim().to_ascii_lowercase();
            let h_lower = h_lower.trim_matches(|c: char| c == '"' || c == '\'');

            // Part number — highest priority match
            if map.part_number.is_none() {
                if h_lower.contains("vendor code")
                    || h_lower.contains("vendor_code")
                    || h_lower == "partnumber"
                    || h_lower == "part number"
                    || h_lower == "part_number"
                    || h_lower == "sku"
                    || h_lower == "code"
                    || h_lower == "item number"
                    || h_lower == "item #"
                    || h_lower == "product code"
                    || h_lower == "part #"
                {
                    map.part_number = Some(i);
                    continue;
                }
            }

            if map.description.is_none()
                && (h_lower.contains("title")
                    || h_lower.contains("desc")
                    || h_lower == "name"
                    || h_lower == "product name")
            {
                map.description = Some(i);
                continue;
            }

            if map.brand.is_none()
                && (h_lower.contains("brand")
                    || h_lower == "manufacturer"
                    || h_lower == "make"
                    || h_lower == "mfr")
            {
                map.brand = Some(i);
                continue;
            }

            if map.supplier.is_none() && h_lower.contains("supplier") {
                map.supplier = Some(i);
                continue;
            }

            if map.price.is_none()
                && (h_lower.contains("price") || h_lower.contains("cost"))
            {
                map.price = Some(i);
                continue;
            }

            if map.currency.is_none()
                && (h_lower.contains("currency")
                    || h_lower.contains("curr")
                    || h_lower == "aed"
                    || h_lower == "usd")
            {
                map.currency = Some(i);
                continue;
            }

            if map.quantity.is_none()
                && (h_lower == "quantity" || h_lower == "qty")
            {
                map.quantity = Some(i);
                continue;
            }

            if map.min_order_qty.is_none()
                && (h_lower.contains("min_lot")
                    || h_lower.contains("min lot")
                    || h_lower.contains("minorder")
                    || h_lower.contains("min_order")
                    || h_lower == "moq"
                    || h_lower == "minimum order")
            {
                map.min_order_qty = Some(i);
                continue;
            }

            // stock vs stock_code disambiguation
            if h_lower == "stock" && map.stock.is_none() {
                map.stock = Some(i);
                continue;
            }
            if map.stock_code.is_none()
                && (h_lower.contains("stock code")
                    || h_lower.contains("stock_code")
                    || h_lower.contains("stockcode")
                    || h_lower == "warehouse")
            {
                map.stock_code = Some(i);
                continue;
            }

            if map.weight.is_none() && h_lower == "weight" {
                map.weight = Some(i);
                continue;
            }
            if map.weight_unit.is_none()
                && (h_lower.contains("weight_unit") || h_lower.contains("weightunit"))
            {
                map.weight_unit = Some(i);
                continue;
            }

            if map.volume.is_none()
                && (h_lower.contains("volume") || h_lower == "vol")
            {
                map.volume = Some(i);
                continue;
            }

            if map.delivery_days.is_none()
                && (h_lower.contains("delivery")
                    || h_lower.contains("lead_time")
                    || h_lower.contains("leadtime"))
            {
                map.delivery_days = Some(i);
                continue;
            }

            if map.category.is_none()
                && (h_lower == "category" || h_lower == "cat")
            {
                map.category = Some(i);
                continue;
            }

            if map.subcategory.is_none()
                && (h_lower.contains("subcategory")
                    || h_lower.contains("subcat")
                    || h_lower.contains("sub_category"))
            {
                map.subcategory = Some(i);
                continue;
            }
        }

        map
    }
}

// =============================================================================
// Fast field extraction helpers — zero allocation on happy path
// =============================================================================

#[inline(always)]
fn get_field<'a>(record: &'a csv::StringRecord, idx: Option<usize>) -> &'a str {
    match idx {
        Some(i) => record.get(i).unwrap_or("").trim().trim_matches(|c: char| c == '"' || c == '\''),
        None => "",
    }
}

#[inline(always)]
fn parse_f64(s: &str) -> f64 {
    if s.is_empty() {
        return 0.0;
    }
    // Strip currency symbols and spaces
    let cleaned: String = s
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-' || *c == ',')
        .collect();
    if cleaned.is_empty() {
        return 0.0;
    }
    // European format: "1234,56" → "1234.56"
    // But "1,234.56" should drop commas
    if cleaned.contains('.') {
        // Has dot — commas are thousand separators, remove them
        cleaned.replace(',', "").parse::<f64>().unwrap_or(0.0)
    } else if cleaned.ends_with(|c: char| c == ',') {
        cleaned.replace(',', "").parse::<f64>().unwrap_or(0.0)
    } else {
        // Might be European decimal comma: "12,34"
        let comma_count = cleaned.matches(',').count();
        if comma_count == 1 {
            // Check if last segment after comma is 1-2 digits (decimal)
            let parts: Vec<&str> = cleaned.split(',').collect();
            if parts.len() == 2 && parts[1].len() <= 2 {
                cleaned.replacen(',', ".", 1).parse::<f64>().unwrap_or(0.0)
            } else {
                // Thousand separator
                cleaned.replace(',', "").parse::<f64>().unwrap_or(0.0)
            }
        } else {
            cleaned.replace(',', "").parse::<f64>().unwrap_or(0.0)
        }
    }
}

#[inline(always)]
fn parse_i64(s: &str) -> i64 {
    if s.is_empty() {
        return 0;
    }
    // Extract first integer sequence
    let mut num_str = String::new();
    for c in s.chars() {
        if c.is_ascii_digit() {
            num_str.push(c);
        } else if !num_str.is_empty() {
            break;
        }
    }
    num_str.parse::<i64>().unwrap_or(0)
}

// =============================================================================
// Extract stock code from filename pattern like "APMG price 1 day_DS1_part1.csv"
// =============================================================================
fn extract_stock_code_from_filename(filename: &str) -> &str {
    // Match _XXXX_part pattern
    if let Some(start) = filename.rfind("_part") {
        let before = &filename[..start];
        if let Some(underscore) = before.rfind('_') {
            return &before[underscore + 1..];
        }
    }
    ""
}

// =============================================================================
// Detect CSV delimiter from first line
// =============================================================================
fn detect_delimiter(path: &Path) -> u8 {
    use std::io::{BufRead};
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return b',',
    };
    let reader = BufReader::new(file);
    if let Some(Ok(first_line)) = reader.lines().next() {
        let semicolons = first_line.matches(';').count();
        let commas = first_line.matches(',').count();
        if semicolons > commas {
            return b';';
        }
    }
    b','
}

// =============================================================================
// Per-file result
// =============================================================================
struct FileResult {
    file_name: String,
    records: u64,
    ndjson_bytes: u64,
    bulk_bytes: u64,
    duration_ms: u64,
    error: Option<String>,
}

// =============================================================================
// Process a single CSV file → NDJSON + ES .bulk
// =============================================================================
fn process_file(
    csv_path: &Path,
    output_dir: &Path,
    integration_id: &str,
    integration_name: &str,
    imported_at: &str,
    es_index_name: &str,
    global_records: &AtomicU64,
    completed_files: &AtomicUsize,
    total_files: usize,
) -> FileResult {
    let file_name = csv_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let start = Instant::now();

    // Output path: input.csv → input.ndjson + input.bulk
    let stem = csv_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy();
    let ndjson_path = output_dir.join(format!("{}.ndjson", stem));
    let bulk_path = output_dir.join(format!("{}.bulk", stem));

    // Detect delimiter
    let delimiter = detect_delimiter(csv_path);

    // Open CSV reader with detected delimiter
    let file = match File::open(csv_path) {
        Ok(f) => f,
        Err(e) => {
            return FileResult {
                file_name,
                records: 0,
                ndjson_bytes: 0,
                bulk_bytes: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("open failed: {}", e)),
            };
        }
    };

    // 256KB read buffer — saturates NVMe read bandwidth per thread
    let buf_reader = BufReader::with_capacity(256 * 1024, file);

    let mut csv_reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .flexible(true) // tolerate ragged rows
        .trim(csv::Trim::All)
        .from_reader(buf_reader);

    // Resolve column map from headers
    let headers = match csv_reader.headers() {
        Ok(h) => h.clone(),
        Err(e) => {
            return FileResult {
                file_name,
                records: 0,
                ndjson_bytes: 0,
                bulk_bytes: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("header parse failed: {}", e)),
            };
        }
    };
    let col_map = ColumnMap::from_headers(&headers);

    // If no part number column found, skip file
    if col_map.part_number.is_none() {
        return FileResult {
            file_name,
            records: 0,
            ndjson_bytes: 0,
            bulk_bytes: 0,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some("no part number column detected".into()),
        };
    }

    // Open NDJSON output — 1MB write buffer for large sequential writes
    let ndjson_file = match File::create(&ndjson_path) {
        Ok(f) => f,
        Err(e) => {
            return FileResult {
                file_name,
                records: 0,
                ndjson_bytes: 0,
                bulk_bytes: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("create ndjson output failed: {}", e)),
            };
        }
    };
    let mut ndjson_writer = BufWriter::with_capacity(1024 * 1024, ndjson_file);

    // Open ES .bulk output — pre-formatted ES _bulk API body
    let bulk_file = match File::create(&bulk_path) {
        Ok(f) => f,
        Err(e) => {
            return FileResult {
                file_name,
                records: 0,
                ndjson_bytes: 0,
                bulk_bytes: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("create bulk output failed: {}", e)),
            };
        }
    };
    let mut bulk_writer = BufWriter::with_capacity(1024 * 1024, bulk_file);

    // Pre-compute ES action line (same for every record in this index)
    let es_action_line = format!(r#"{{"index":{{"_index":"{}"}}}}
"#, es_index_name);
    let es_action_bytes = es_action_line.as_bytes();

    // Pre-extract stock code from filename
    let filename_stock_code = extract_stock_code_from_filename(&file_name);

    // Reusable serialization buffers — avoids per-record allocation
    let mut ndjson_buf = Vec::with_capacity(1024);
    let mut bulk_doc_buf = Vec::with_capacity(1024);

    let mut record_count: u64 = 0;
    let mut ndjson_bytes_written: u64 = 0;
    let mut bulk_bytes_written: u64 = 0;
    let mut csv_record = csv::StringRecord::new();

    // Main loop — stream records one by one
    loop {
        match csv_reader.read_record(&mut csv_record) {
            Ok(true) => {}
            Ok(false) => break, // EOF
            Err(_) => continue,  // skip malformed rows
        }

        let part_number = get_field(&csv_record, col_map.part_number);
        if part_number.is_empty() {
            continue;
        }

        // Resolve stock code: column value > filename extraction
        let raw_stock_code = get_field(&csv_record, col_map.stock_code);
        let stock_code = if raw_stock_code.is_empty() {
            filename_stock_code
        } else {
            raw_stock_code
        };

        let currency_raw = get_field(&csv_record, col_map.currency);
        let currency = if currency_raw.is_empty() {
            "AED"
        } else {
            currency_raw
        };

        let weight_unit_raw = get_field(&csv_record, col_map.weight_unit);
        let weight_unit = if weight_unit_raw.is_empty() {
            "kg"
        } else {
            weight_unit_raw
        };

        let stock_raw = get_field(&csv_record, col_map.stock);
        let stock = if stock_raw.is_empty() {
            "unknown"
        } else {
            stock_raw
        };

        let min_order_raw = parse_i64(get_field(&csv_record, col_map.min_order_qty));
        let min_order_qty = if min_order_raw < 1 { 1 } else { min_order_raw };

        let doc = PartRecord {
            part_number,
            description: get_field(&csv_record, col_map.description),
            brand: get_field(&csv_record, col_map.brand),
            supplier: get_field(&csv_record, col_map.supplier),
            price: parse_f64(get_field(&csv_record, col_map.price)),
            currency,
            quantity: parse_i64(get_field(&csv_record, col_map.quantity)),
            min_order_qty,
            stock,
            stock_code,
            weight: parse_f64(get_field(&csv_record, col_map.weight)),
            weight_unit,
            volume: parse_f64(get_field(&csv_record, col_map.volume)),
            delivery_days: parse_i64(get_field(&csv_record, col_map.delivery_days)),
            category: get_field(&csv_record, col_map.category),
            subcategory: get_field(&csv_record, col_map.subcategory),
            integration: integration_id,
            integration_name,
            file_name: &file_name,
            imported_at,
        };

        // ES document — same fields minus imported_at
        let es_doc = PartRecordES {
            part_number,
            description: doc.description,
            brand: doc.brand,
            supplier: doc.supplier,
            price: doc.price,
            currency,
            quantity: doc.quantity,
            min_order_qty: doc.min_order_qty,
            stock,
            stock_code,
            weight: doc.weight,
            weight_unit,
            volume: doc.volume,
            delivery_days: doc.delivery_days,
            category: doc.category,
            subcategory: doc.subcategory,
            integration: integration_id,
            integration_name,
            file_name: &file_name,
        };

        // Write NDJSON (for mongoimport)
        ndjson_buf.clear();
        if serde_json::to_writer(&mut ndjson_buf, &doc).is_ok() {
            ndjson_buf.push(b'\n');
            let n = ndjson_buf.len();
            if ndjson_writer.write_all(&ndjson_buf).is_ok() {
                ndjson_bytes_written += n as u64;
            }
        }

        // Write ES _bulk body (action line + document)
        bulk_doc_buf.clear();
        if serde_json::to_writer(&mut bulk_doc_buf, &es_doc).is_ok() {
            bulk_doc_buf.push(b'\n');
            let action_n = es_action_bytes.len();
            let doc_n = bulk_doc_buf.len();
            if bulk_writer.write_all(es_action_bytes).is_ok()
                && bulk_writer.write_all(&bulk_doc_buf).is_ok()
            {
                bulk_bytes_written += (action_n + doc_n) as u64;
            }
        }

        record_count += 1;

        // Periodic progress: every 500k records, update global counter
        if record_count % 500_000 == 0 {
            global_records.fetch_add(500_000, Ordering::Relaxed);
        }
    }

    // Flush both writers
    let _ = ndjson_writer.flush();
    let _ = bulk_writer.flush();

    // Add leftover count to global
    let leftover = record_count % 500_000;
    if leftover > 0 {
        global_records.fetch_add(leftover, Ordering::Relaxed);
    }

    let done = completed_files.fetch_add(1, Ordering::Relaxed) + 1;

    // Print per-file progress (JSON, machine-readable)
    let elapsed = start.elapsed();
    let rate = if elapsed.as_secs() > 0 {
        record_count / elapsed.as_secs()
    } else {
        record_count
    };

    let progress = format!(
        r#"{{"event":"file_done","file":"{}","records":{},"ndjson_bytes":{},"bulk_bytes":{},"duration_ms":{},"rate_per_sec":{},"progress":"{}/{}"}}"#,
        file_name,
        record_count,
        ndjson_bytes_written,
        bulk_bytes_written,
        elapsed.as_millis(),
        rate,
        done,
        total_files
    );
    // Write to stderr so stdout stays clean for final summary
    eprintln!("{}", progress);

    FileResult {
        file_name,
        records: record_count,
        ndjson_bytes: ndjson_bytes_written,
        bulk_bytes: bulk_bytes_written,
        duration_ms: elapsed.as_millis() as u64,
        error: None,
    }
}

// =============================================================================
// MAIN
// =============================================================================
fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 3 {
        eprintln!(
            "Usage: {} <input_dir> <output_dir> [integration_id] [integration_name] [es_index_name]",
            args[0]
        );
        eprintln!("  input_dir:        Directory containing CSV files");
        eprintln!("  output_dir:       Directory to write NDJSON + .bulk files");
        eprintln!("  integration_id:   MongoDB ObjectId (optional)");
        eprintln!("  integration_name: Human-readable name (optional)");
        eprintln!("  es_index_name:    Elasticsearch index name for .bulk action lines (optional)");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let output_dir = PathBuf::from(&args[2]);
    let integration_id = args.get(3).map(|s| s.as_str()).unwrap_or("");
    let integration_name = args.get(4).map(|s| s.as_str()).unwrap_or("");
    let es_index_name = args.get(5).map(|s| s.as_str()).unwrap_or("automotive_parts");

    // Validate input directory
    if !input_dir.is_dir() {
        eprintln!("ERROR: input directory does not exist: {}", input_dir.display());
        std::process::exit(1);
    }

    // Create output directory
    if let Err(e) = fs::create_dir_all(&output_dir) {
        eprintln!("ERROR: cannot create output directory: {}", e);
        std::process::exit(1);
    }

    // Enumerate CSV files
    let mut csv_files: Vec<PathBuf> = Vec::new();
    match fs::read_dir(&input_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.eq_ignore_ascii_case("csv") {
                            csv_files.push(path);
                        }
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("ERROR: cannot read input directory: {}", e);
            std::process::exit(1);
        }
    }

    if csv_files.is_empty() {
        eprintln!("ERROR: no CSV files found in {}", input_dir.display());
        std::process::exit(1);
    }

    // Sort for deterministic processing order (largest files first for better load balancing)
    csv_files.sort_by(|a, b| {
        let size_a = fs::metadata(a).map(|m| m.len()).unwrap_or(0);
        let size_b = fs::metadata(b).map(|m| m.len()).unwrap_or(0);
        size_b.cmp(&size_a) // Descending — largest first
    });

    let total_files = csv_files.len();
    let total_input_bytes: u64 = csv_files
        .iter()
        .map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0))
        .sum();

    // Timestamp for all records in this batch
    let imported_at = chrono_now_iso8601();

    // Global counters
    let global_records = Arc::new(AtomicU64::new(0));
    let completed_files = Arc::new(AtomicUsize::new(0));

    let num_threads = rayon::current_num_threads();

    eprintln!(
        r#"{{"event":"start","files":{},"total_bytes":{},"threads":{},"input_dir":"{}","output_dir":"{}"}}"#,
        total_files,
        total_input_bytes,
        num_threads,
        input_dir.display(),
        output_dir.display()
    );

    let overall_start = Instant::now();

    // PARALLEL PROCESSING — one file per rayon thread
    let results: Vec<FileResult> = csv_files
        .par_iter()
        .map(|csv_path| {
            process_file(
                csv_path,
                &output_dir,
                integration_id,
                integration_name,
                &imported_at,
                es_index_name,
                &global_records,
                &completed_files,
                total_files,
            )
        })
        .collect();

    let overall_duration = overall_start.elapsed();

    // Aggregate results
    let mut total_records: u64 = 0;
    let mut total_ndjson_bytes: u64 = 0;
    let mut total_bulk_bytes: u64 = 0;
    let mut errors: Vec<String> = Vec::new();
    let mut file_results: Vec<String> = Vec::new();

    for r in &results {
        total_records += r.records;
        total_ndjson_bytes += r.ndjson_bytes;
        total_bulk_bytes += r.bulk_bytes;
        if let Some(ref e) = r.error {
            errors.push(format!("{}: {}", r.file_name, e));
        }
        file_results.push(format!(
            r#"{{"file":"{}","records":{},"ndjson_bytes":{},"bulk_bytes":{},"duration_ms":{}}}"#,
            r.file_name, r.records, r.ndjson_bytes, r.bulk_bytes, r.duration_ms
        ));
    }

    let duration_ms = overall_duration.as_millis() as u64;
    let rate = if duration_ms > 0 {
        (total_records as f64 / (duration_ms as f64 / 1000.0)) as u64
    } else {
        total_records
    };

    // Final summary on stdout — machine-readable JSON
    println!(
        r#"{{"event":"complete","total_records":{},"total_ndjson_bytes":{},"total_bulk_bytes":{},"total_input_bytes":{},"duration_ms":{},"rate_per_sec":{},"files_processed":{},"files_total":{},"errors":{},"threads":{},"es_index":"{}"}}"#,
        total_records,
        total_ndjson_bytes,
        total_bulk_bytes,
        total_input_bytes,
        duration_ms,
        rate,
        results.len() - errors.len(),
        total_files,
        errors.len(),
        num_threads,
        es_index_name
    );

    if !errors.is_empty() {
        for e in &errors {
            eprintln!("ERROR: {}", e);
        }
        // Still exit 0 if some files succeeded — let Node.js decide
        if total_records == 0 {
            std::process::exit(1);
        }
    }
}

// =============================================================================
// Minimal ISO8601 timestamp without pulling in chrono crate
// =============================================================================
fn chrono_now_iso8601() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0));
    let secs = now.as_secs();

    // Calculate UTC date/time components
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    let millis = now.subsec_millis();

    // Days since epoch to Y-M-D (simplified Gregorian)
    let (year, month, day) = epoch_days_to_ymd(days as i64);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hours, minutes, seconds, millis
    )
}

fn epoch_days_to_ymd(mut days: i64) -> (i64, u32, u32) {
    // Algorithm from Howard Hinnant
    days += 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = (days - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
