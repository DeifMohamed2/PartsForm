const mongoose = require('mongoose');

/**
 * SystemSettings Model
 * Stores global system configuration settings.
 * Uses a singleton pattern - only one document exists in the collection.
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    // Price Markup Settings
    defaultMarkupPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Default markup cannot be negative'],
      max: [100, 'Default markup cannot exceed 100%'],
    },

    // Singleton key - ensures only one settings document exists
    _singleton: {
      type: String,
      default: 'global',
      unique: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret._singleton;
        return ret;
      },
    },
  }
);

/**
 * Get the global settings (creates default if not exists)
 * @returns {Promise<Object>} The system settings document
 */
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ _singleton: 'global' });
  if (!settings) {
    settings = await this.create({ _singleton: 'global' });
  }
  return settings;
};

/**
 * Update the global settings
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} The updated settings document
 */
systemSettingsSchema.statics.updateSettings = async function (updates) {
  const settings = await this.findOneAndUpdate(
    { _singleton: 'global' },
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  );
  return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
