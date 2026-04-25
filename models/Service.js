const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    serviceId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, trim: true, default: '\u{1F6E0}\uFE0F' },
    description: { type: String, required: true, trim: true },
    priceFrom: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: 'General' },
    backgroundImage: { type: String, trim: true },
    reviewCriteria: [{ type: String, trim: true }],
    isCustom: { type: Boolean, default: true },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },
    ownerUserId: { type: String, trim: true },
    ownerUserName: { type: String, trim: true },
    ownerUserEmail: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    publishedAt: { type: Date },
    publishedBy: { type: String, trim: true },
    createdBy: { type: String, default: 'admin' },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
