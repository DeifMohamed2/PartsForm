#!/usr/bin/env bash
# Build the Rust CSV→NDJSON transform engine
# Run: bash scripts/build-rust-transform.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../rust-transform"

echo "=== Building Rust Turbo Transform ==="

# Check Rust is installed
if ! command -v cargo &>/dev/null; then
  echo "ERROR: Rust not installed. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

cd "$PROJECT_DIR"

echo "Compiling with release profile (LTO + native CPU)..."
cargo build --release

BINARY="$PROJECT_DIR/target/release/turbo-transform"
if [[ -f "$BINARY" ]]; then
  SIZE=$(ls -lh "$BINARY" | awk '{print $5}')
  echo ""
  echo "=== BUILD SUCCESS ==="
  echo "Binary: $BINARY"
  echo "Size:   $SIZE"
  echo ""
  echo "The turboSyncEngine will automatically detect and use this binary."
  echo "If the binary is not found, it falls back to Node.js transform."
else
  echo "ERROR: Binary not found after build"
  exit 1
fi
