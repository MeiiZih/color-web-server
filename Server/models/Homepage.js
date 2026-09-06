const mongoose = require('mongoose');

const homepageSchema = new mongoose.Schema({
    type: { type: String, enum: ['news', 'common'], required: true },
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    link: { type: String, required: true },
    description: { type: String, required: true },
    sourceName: String,
    contentKind: { type: String, enum: ['workshop', 'lecture', 'article', 'paper', 'resource'] },
    registrationUrl: String,
    sourcePublishedAt: String,
    sourceCheckedAt: String,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 更新 updatedAt 時間戳
homepageSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Homepage', homepageSchema);
