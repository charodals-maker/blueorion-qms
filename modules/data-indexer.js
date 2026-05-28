/**
 * Data Indexer Module for BLUEORION QMS
 * Creates searchable indexes for fast data lookups
 * Phase 1: Performance Enhancement
 */

class DataIndexer {
  constructor(data = [], indexFields = {}) {
    this.data = data;
    this.indexes = {};
    this.indexFields = indexFields; // { fieldName: true, otherField: 'composite' }
    this.buildIndexes();
  }

  /**
   * Rebuild all indexes
   */
  buildIndexes() {
    this.indexes = {};
    
    // Build individual field indexes
    for (const [field, config] of Object.entries(this.indexFields)) {
      if (config === true || config === 'unique') {
        this.buildUniqueIndex(field);
      } else if (config === 'multi') {
        this.buildMultiIndex(field);
      }
    }
  }

  /**
   * Build unique index for a field (one-to-one mapping)
   * @param {string} field - Field name to index
   */
  buildUniqueIndex(field) {
    this.indexes[field] = new Map();
    for (const item of this.data) {
      const value = this.getFieldValue(item, field);
      if (value !== null && value !== undefined) {
        const key = String(value).toUpperCase();
        this.indexes[field].set(key, item);
      }
    }
  }

  /**
   * Build multi-value index for a field (many-to-one mapping)
   * @param {string} field - Field name to index
   */
  buildMultiIndex(field) {
    this.indexes[field] = {};
    for (const item of this.data) {
      const value = this.getFieldValue(item, field);
      if (value) {
        const key = String(value);
        if (!this.indexes[field][key]) {
          this.indexes[field][key] = [];
        }
        this.indexes[field][key].push(item);
      }
    }
  }

  /**
   * Get field value from object (supports nested fields with dot notation)
   * @param {object} obj - Object to access
   * @param {string} field - Field path (e.g., 'address.country')
   * @returns {*} Field value
   */
  getFieldValue(obj, field) {
    const parts = field.split('.');
    let value = obj;
    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }
    return value;
  }

  /**
   * Find by unique index
   * @param {string} field - Indexed field
   * @param {*} value - Value to find
   * @returns {object|null} Found item or null
   */
  findByIndex(field, value) {
    if (!this.indexes[field]) return null;
    const key = String(value).toUpperCase();
    return this.indexes[field].get ? this.indexes[field].get(key) : null;
  }

  /**
   * Find all by multi-index
   * @param {string} field - Indexed field
   * @param {*} value - Value to find
   * @returns {array} Array of matching items
   */
  findAllByIndex(field, value) {
    if (!this.indexes[field]) return [];
    const key = String(value);
    return this.indexes[field][key] || [];
  }

  /**
   * Create composite filter (AND logic)
   * @param {object} filters - { field1: value1, field2: value2, ... }
   * @returns {array} Matching items
   */
  filter(filters) {
    let results = this.data;

    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      
      results = results.filter(item => {
        const itemValue = this.getFieldValue(item, field);
        if (typeof itemValue === 'string' && typeof value === 'string') {
          return itemValue.toUpperCase().includes(value.toUpperCase());
        }
        return itemValue === value;
      });
    }

    return results;
  }

  /**
   * Add item to indexes
   * @param {object} item - Item to index
   */
  add(item) {
    this.data.push(item);
    for (const field of Object.keys(this.indexFields)) {
      if (this.indexes[field] instanceof Map) {
        const value = this.getFieldValue(item, field);
        if (value) {
          const key = String(value).toUpperCase();
          this.indexes[field].set(key, item);
        }
      } else {
        const value = this.getFieldValue(item, field);
        if (value) {
          const key = String(value);
          if (!this.indexes[field][key]) {
            this.indexes[field][key] = [];
          }
          this.indexes[field][key].push(item);
        }
      }
    }
  }

  /**
   * Remove item from indexes
   * @param {*} identifier - ID or unique field value to match
   */
  remove(identifier) {
    const idx = this.data.findIndex(item => item.id === identifier);
    if (idx === -1) return false;

    const item = this.data[idx];
    this.data.splice(idx, 1);

    // Remove from all indexes
    for (const field of Object.keys(this.indexFields)) {
      if (this.indexes[field] instanceof Map) {
        const value = this.getFieldValue(item, field);
        if (value) {
          const key = String(value).toUpperCase();
          this.indexes[field].delete(key);
        }
      } else {
        const value = this.getFieldValue(item, field);
        if (value) {
          const key = String(value);
          if (this.indexes[field][key]) {
            this.indexes[field][key] = this.indexes[field][key].filter(
              i => i.id !== item.id
            );
          }
        }
      }
    }
    return true;
  }

  /**
   * Get index statistics
   * @returns {object} Stats object
   */
  getStats() {
    const stats = { dataSize: this.data.length, indexes: {} };
    for (const [field, index] of Object.entries(this.indexes)) {
      if (index instanceof Map) {
        stats.indexes[field] = { type: 'unique', entries: index.size };
      } else {
        stats.indexes[field] = { type: 'multi', entries: Object.keys(index).length };
      }
    }
    return stats;
  }
}

module.exports = DataIndexer;
