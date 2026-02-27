/**
 * Supplier Data Service
 * Handles all data operations for supplier tables with:
 * - CRUD operations with validation
 * - Concurrency control (optimistic locking)
 * - Bulk operations
 * - Import/Export
 * - Audit logging
 * - Cache management
 */
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const AuditLog = require('../models/AuditLog');
const Supplier = require('../models/Supplier');
const { EventEmitter } = require('events');

class SupplierDataService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Build actor info for audit logs
   */
  buildActorInfo(user, type = 'supplier') {
    if (!user) {
      return { type: 'system', name: 'System' };
    }
    return {
      type,
      id: user._id,
      name: user.fullName || user.companyName || user.contactName || 'Unknown',
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Build request info for audit logs
   */
  buildRequestInfo(req) {
    if (!req) return null;
    return {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get?.('user-agent'),
      endpoint: req.originalUrl,
      method: req.method,
      requestId: req.id,
    };
  }

  // ==================== TABLE OPERATIONS ====================

  /**
   * Create a new data table
   */
  async createTable({ supplier, name, description, columns, settings, createdBy, req }) {
    const supplierId = supplier._id || supplier;
    
    // Check quota
    const tableCount = await DataTable.countDocuments({ supplier: supplierId, status: { $ne: 'archived' } });
    const supplierDoc = await Supplier.findById(supplierId);
    
    if (tableCount >= (supplierDoc?.quotas?.maxTables || 10)) {
      throw new Error(`Table limit reached (max: ${supplierDoc?.quotas?.maxTables || 10})`);
    }

    // Generate unique slug
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const existingSlug = await DataTable.findOne({ supplier: supplierId, slug });
    if (existingSlug) {
      slug = `${slug}_${Date.now()}`;
    }

    // Ensure columns have proper keys
    const processedColumns = columns.map((col, idx) => ({
      ...col,
      key: col.key || col.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      order: col.order || idx,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const table = new DataTable({
      supplier: supplierId,
      name,
      slug,
      description,
      columns: processedColumns,
      settings: settings || {},
      primaryKey: settings?.primaryKey || [processedColumns[0]?.key].filter(Boolean),
      createdBy: createdBy?._id || createdBy,
      updatedBy: createdBy?._id || createdBy,
    });

    await table.save();

    // Audit log
    await AuditLog.logTableAction({
      action: 'table.create',
      table,
      supplier: supplierId,
      actor: this.buildActorInfo(createdBy),
      changes: { after: { name, slug, columns: processedColumns.length } },
      request: this.buildRequestInfo(req),
    });

    this.emit('table:created', { table, supplier: supplierId });
    return table;
  }

  /**
   * Update table metadata (name, description, settings)
   */
  async updateTable({ tableId, updates, updatedBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    const before = {
      name: table.name,
      description: table.description,
      settings: { ...table.settings },
    };

    // Apply allowed updates
    if (updates.name) table.name = updates.name;
    if (updates.description !== undefined) table.description = updates.description;
    if (updates.settings) {
      table.settings = { ...table.settings, ...updates.settings };
    }
    
    table.updatedBy = updatedBy?._id || updatedBy;
    await table.save();

    await AuditLog.logTableAction({
      action: 'table.update',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(updatedBy),
      changes: {
        before,
        after: { name: table.name, description: table.description, settings: table.settings },
        fields: Object.keys(updates),
      },
      request: this.buildRequestInfo(req),
    });

    this.emit('table:updated', { table });
    return table;
  }

  /**
   * Update table columns (add, modify, remove)
   */
  async updateTableColumns({ tableId, columns, updatedBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    const beforeColumns = table.columns.map(c => ({ key: c.key, name: c.name, type: c.type }));

    // Process columns preserving existing data
    table.columns = columns.map((col, idx) => ({
      ...col,
      key: col.key || col.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      order: col.order !== undefined ? col.order : idx,
      updatedAt: new Date(),
      createdAt: col.createdAt || new Date(),
    }));

    table.updatedBy = updatedBy?._id || updatedBy;
    await table.save();

    await AuditLog.logTableAction({
      action: 'table.update',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(updatedBy),
      changes: {
        before: { columns: beforeColumns },
        after: { columns: table.columns.map(c => ({ key: c.key, name: c.name, type: c.type })) },
        fields: ['columns'],
      },
      request: this.buildRequestInfo(req),
    });

    return table;
  }

  /**
   * Archive a table (soft delete)
   */
  async archiveTable({ tableId, archivedBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    table.status = 'archived';
    table.updatedBy = archivedBy?._id || archivedBy;
    await table.save();

    await AuditLog.logTableAction({
      action: 'table.archive',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(archivedBy),
      request: this.buildRequestInfo(req),
    });

    this.emit('table:archived', { table });
    return table;
  }

  /**
   * Delete a table permanently
   */
  async deleteTable({ tableId, deletedBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    // Delete all associated records
    const deleteResult = await DataRecord.deleteMany({ table: tableId });

    await AuditLog.logTableAction({
      action: 'table.delete',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(deletedBy),
      changes: { deleted: { recordCount: deleteResult.deletedCount } },
      request: this.buildRequestInfo(req),
      status: 'success',
    });

    await table.deleteOne();

    this.emit('table:deleted', { tableId, supplier: table.supplier });
    return { deleted: true, recordsDeleted: deleteResult.deletedCount };
  }

  /**
   * Get tables for a supplier
   */
  async getTables({ supplier, status = 'active', includeStats = true }) {
    const supplierId = supplier._id || supplier;
    
    const query = { supplier: supplierId };
    if (status !== 'all') query.status = status;

    let tables = await DataTable.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    if (includeStats) {
      // Get record counts for each table
      const tableCounts = await DataRecord.aggregate([
        { $match: { supplier: supplierId, status: 'active' } },
        { $group: { _id: '$table', count: { $sum: 1 } } },
      ]);

      const countMap = new Map(tableCounts.map(t => [t._id.toString(), t.count]));

      tables = tables.map(table => ({
        ...table,
        stats: {
          ...table.stats,
          recordCount: countMap.get(table._id.toString()) || 0,
        },
      }));
    }

    return tables;
  }

  /**
   * Get a single table by ID
   */
  async getTable({ tableId, includeStats = true }) {
    const table = await DataTable.findById(tableId).lean();
    if (!table) return null;

    if (includeStats) {
      const recordCount = await DataRecord.countDocuments({ 
        table: tableId, 
        status: 'active' 
      });
      table.stats = { ...table.stats, recordCount };
    }

    return table;
  }

  // ==================== RECORD OPERATIONS ====================

  /**
   * Create a single record
   */
  async createRecord({ tableId, data, createdBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');
    if (table.status !== 'active') throw new Error('Table is not active');

    // Validate and cast data
    const validation = table.validateRecord(data);
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.validationErrors = validation.errors;
      throw error;
    }

    const castedData = table.castRecord(data);
    const rowKey = DataRecord.generateRowKey(castedData, table.primaryKey);

    // Check for duplicate primary key
    const existing = await DataRecord.findOne({ 
      table: tableId, 
      rowKey, 
      status: 'active' 
    });
    
    if (existing) {
      throw new Error(`Record with key "${rowKey}" already exists`);
    }

    const record = new DataRecord({
      table: tableId,
      supplier: table.supplier,
      data: castedData,
      rowKey,
      createdBy: createdBy?._id || createdBy,
      updatedBy: createdBy?._id || createdBy,
    });

    await record.save();

    // Update table stats
    await DataTable.updateOne(
      { _id: tableId },
      { $inc: { 'stats.recordCount': 1 }, $set: { 'stats.lastRecordAt': new Date() } }
    );

    await AuditLog.logRecordAction({
      action: 'record.create',
      record,
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(createdBy),
      changes: { after: castedData },
      request: this.buildRequestInfo(req),
    });

    this.emit('record:created', { record, table });
    return record;
  }

  /**
   * Update a single record with optimistic locking
   */
  async updateRecord({ recordId, data, lockVersion, updatedBy, req }) {
    const record = await DataRecord.findById(recordId);
    if (!record) throw new Error('Record not found');
    if (record.status !== 'active') throw new Error('Record is not active');

    const table = await DataTable.findById(record.table);
    if (!table) throw new Error('Table not found');

    // Validate new data
    const mergedData = { ...record.data, ...data };
    const validation = table.validateRecord(mergedData);
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.validationErrors = validation.errors;
      throw error;
    }

    const castedData = table.castRecord(mergedData);
    const beforeData = { ...record.data };

    // Use optimistic locking
    try {
      await record.updateWithLock(castedData, lockVersion, updatedBy?._id || updatedBy);
    } catch (error) {
      if (error.code === 'CONCURRENT_MODIFICATION') {
        error.message = 'This record has been modified by another user. Please refresh and try again.';
      }
      throw error;
    }

    await AuditLog.logRecordAction({
      action: 'record.update',
      record,
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(updatedBy),
      changes: {
        before: beforeData,
        after: record.data,
        fields: Object.keys(data),
      },
      request: this.buildRequestInfo(req),
    });

    this.emit('record:updated', { record, table });
    return record;
  }

  /**
   * Delete a single record (soft delete)
   */
  async deleteRecord({ recordId, deletedBy, req }) {
    const record = await DataRecord.findById(recordId);
    if (!record) throw new Error('Record not found');

    const table = await DataTable.findById(record.table);

    await record.softDelete(deletedBy?._id || deletedBy);

    // Update table stats
    await DataTable.updateOne(
      { _id: record.table },
      { $inc: { 'stats.recordCount': -1 } }
    );

    await AuditLog.logRecordAction({
      action: 'record.delete',
      record,
      table,
      supplier: record.supplier,
      actor: this.buildActorInfo(deletedBy),
      request: this.buildRequestInfo(req),
    });

    this.emit('record:deleted', { record, table });
    return { deleted: true };
  }

  /**
   * Get records with pagination, filtering, and sorting
   */
  async getRecords({
    tableId,
    page = 1,
    limit = 50,
    sort = { updatedAt: -1 },
    filters = {},
    search = '',
    status = 'active',
  }) {
    const query = { table: tableId, status };

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          query[`data.${key}`] = { $in: value };
        } else if (typeof value === 'object' && (value.$gte || value.$lte || value.$gt || value.$lt)) {
          query[`data.${key}`] = value;
        } else {
          query[`data.${key}`] = value;
        }
      }
    }

    // Apply text search
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object for nested data
    const sortObj = {};
    for (const [key, value] of Object.entries(sort)) {
      if (key.startsWith('data.')) {
        sortObj[key] = value;
      } else if (['createdAt', 'updatedAt', 'version', 'lockVersion'].includes(key)) {
        sortObj[key] = value;
      } else {
        sortObj[`data.${key}`] = value;
      }
    }

    return DataRecord.findWithPagination(query, {
      page,
      limit,
      sort: sortObj,
    });
  }

  /**
   * Get a single record by ID
   */
  async getRecord({ recordId }) {
    return DataRecord.findById(recordId).lean();
  }

  /**
   * Restore a deleted record
   */
  async restoreRecord({ recordId, restoredBy, req }) {
    const record = await DataRecord.findById(recordId);
    if (!record) throw new Error('Record not found');
    if (record.status !== 'deleted') throw new Error('Record is not deleted');

    const table = await DataTable.findById(record.table);

    await record.restore(restoredBy?._id || restoredBy);

    // Update table stats
    await DataTable.updateOne(
      { _id: record.table },
      { $inc: { 'stats.recordCount': 1 } }
    );

    await AuditLog.logRecordAction({
      action: 'record.restore',
      record,
      table,
      supplier: record.supplier,
      actor: this.buildActorInfo(restoredBy),
      request: this.buildRequestInfo(req),
    });

    return record;
  }

  /**
   * Restore record to a previous version
   */
  async restoreRecordVersion({ recordId, version, restoredBy, req }) {
    const record = await DataRecord.findById(recordId);
    if (!record) throw new Error('Record not found');

    const table = await DataTable.findById(record.table);
    const beforeData = { ...record.data };

    record.restoreToVersion(version, restoredBy?._id || restoredBy);
    await record.save();

    await AuditLog.logRecordAction({
      action: 'version.restore',
      record,
      table,
      supplier: record.supplier,
      actor: this.buildActorInfo(restoredBy),
      changes: {
        before: beforeData,
        after: record.data,
        fields: ['_version'],
      },
      request: this.buildRequestInfo(req),
    });

    return record;
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk create records
   */
  async bulkCreateRecords({ tableId, records, createdBy, req, skipDuplicates = true }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    const correlationId = `bulk_create_${Date.now()}`;
    const results = { success: [], failed: [], skipped: [] };
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const recordsToInsert = [];

      for (const data of batch) {
        try {
          const validation = table.validateRecord(data);
          if (!validation.valid) {
            results.failed.push({ data, errors: validation.errors });
            continue;
          }

          const castedData = table.castRecord(data);
          const rowKey = DataRecord.generateRowKey(castedData, table.primaryKey);

          // Check for duplicate in batch
          if (recordsToInsert.find(r => r.rowKey === rowKey)) {
            if (skipDuplicates) {
              results.skipped.push({ data, reason: 'duplicate_in_batch' });
            } else {
              results.failed.push({ data, errors: [{ message: 'Duplicate in batch' }] });
            }
            continue;
          }

          recordsToInsert.push({
            table: tableId,
            supplier: table.supplier,
            data: castedData,
            rowKey,
            createdBy: createdBy?._id || createdBy,
            updatedBy: createdBy?._id || createdBy,
            version: 1,
            versionHistory: [{
              version: 1,
              data: castedData,
              changedBy: createdBy?._id || createdBy,
              changedAt: new Date(),
              changeType: 'import',
              changedFields: Object.keys(castedData),
            }],
          });
        } catch (error) {
          results.failed.push({ data, errors: [{ message: error.message }] });
        }
      }

      // Insert batch
      if (recordsToInsert.length > 0) {
        try {
          const inserted = await DataRecord.insertMany(recordsToInsert, { ordered: false });
          results.success.push(...inserted.map(r => ({ id: r._id, rowKey: r.rowKey })));
        } catch (error) {
          // Handle duplicate key errors
          if (error.code === 11000) {
            for (const writeError of error.writeErrors || []) {
              const failedRecord = recordsToInsert[writeError.index];
              if (skipDuplicates) {
                results.skipped.push({ data: failedRecord.data, reason: 'duplicate_exists' });
              } else {
                results.failed.push({ data: failedRecord.data, errors: [{ message: 'Duplicate key' }] });
              }
            }
            // Still count successful inserts
            const insertedCount = recordsToInsert.length - (error.writeErrors?.length || 0);
            results.success.push(...Array(insertedCount).fill({ id: 'batch_insert' }));
          } else {
            results.failed.push(...recordsToInsert.map(r => ({ 
              data: r.data, 
              errors: [{ message: error.message }] 
            })));
          }
        }
      }
    }

    // Update table stats
    await DataTable.updateOne(
      { _id: tableId },
      { 
        $inc: { 'stats.recordCount': results.success.length },
        $set: { 'stats.lastImportAt': new Date(), 'stats.lastRecordAt': new Date() }
      }
    );

    // Audit log
    await AuditLog.logBulkAction({
      action: 'record.bulk_create',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(createdBy),
      bulkInfo: {
        totalRecords: records.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
      },
      request: this.buildRequestInfo(req),
      correlationId,
    });

    this.emit('records:bulk_created', { table, results });
    return results;
  }

  /**
   * Bulk update records
   */
  async bulkUpdateRecords({ updates, updatedBy, req }) {
    const correlationId = `bulk_update_${Date.now()}`;
    const results = await DataRecord.bulkUpdateWithLock(updates, updatedBy?._id || updatedBy);

    // Group by table for audit logging
    const tableGroups = new Map();
    for (const update of updates) {
      const record = await DataRecord.findById(update.id).select('table');
      if (record) {
        if (!tableGroups.has(record.table.toString())) {
          tableGroups.set(record.table.toString(), []);
        }
        tableGroups.get(record.table.toString()).push(update);
      }
    }

    for (const [tableId, tableUpdates] of tableGroups) {
      const table = await DataTable.findById(tableId);
      await AuditLog.logBulkAction({
        action: 'record.bulk_update',
        table,
        supplier: table.supplier,
        actor: this.buildActorInfo(updatedBy),
        bulkInfo: {
          totalRecords: tableUpdates.length,
          successCount: results.success.filter(s => tableUpdates.find(u => u.id === s.id)).length,
          failedCount: results.failed.filter(f => tableUpdates.find(u => u.id === f.id)).length,
        },
        request: this.buildRequestInfo(req),
        correlationId,
      });
    }

    return results;
  }

  /**
   * Bulk delete records
   */
  async bulkDeleteRecords({ tableId, recordIds, deletedBy, req }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    const correlationId = `bulk_delete_${Date.now()}`;
    
    const result = await DataRecord.updateMany(
      { _id: { $in: recordIds }, table: tableId, status: 'active' },
      { 
        $set: { 
          status: 'deleted', 
          deletedAt: new Date(), 
          deletedBy: deletedBy?._id || deletedBy 
        } 
      }
    );

    // Update table stats
    await DataTable.updateOne(
      { _id: tableId },
      { $inc: { 'stats.recordCount': -result.modifiedCount } }
    );

    await AuditLog.logBulkAction({
      action: 'record.bulk_delete',
      table,
      supplier: table.supplier,
      actor: this.buildActorInfo(deletedBy),
      bulkInfo: {
        totalRecords: recordIds.length,
        successCount: result.modifiedCount,
        failedCount: recordIds.length - result.modifiedCount,
      },
      request: this.buildRequestInfo(req),
      correlationId,
    });

    return { deleted: result.modifiedCount };
  }
}

// Export singleton instance
module.exports = new SupplierDataService();
