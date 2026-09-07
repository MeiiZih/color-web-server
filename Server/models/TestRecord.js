const mongoose = require('mongoose');

const testRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
    sourceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestRecord', immutable: true },
    legacyImportedAt: { type: Date, immutable: true },
    email: { type: String, required: false }, // 改為非必需，因為訪客可能沒有 email
    guestId: { type: String, required: false }, // 新增訪客 ID 欄位
    userName: { type: String },
    testType: { type: String, required: true },
    result: { type: String },
    details: { type: String },
    // Immutable questionnaire snapshot for the new multi-survey client.
    exploration: { type: mongoose.Schema.Types.Mixed },
    reflection: { choice: { type: String, enum: ['red','yellow','green','blue','none','other'] }, text: { type: String, maxlength: 500 }, updatedAt: Date },
    
    // MBTI與色彩測驗專用字段
    mbtiResult: { type: String },
    colorResult: {
        primary: [{ type: String }],
        secondary: [{ type: String }],
        third: [{ type: String }],
        fourth: [{ type: String }]
    },
    
    // 使用者的測驗答案
    answers: [{
        questionId: Number,
        question: String,
        answer: String
    }],
    
    // 測驗得分 (如果有)
    scores: {
        E: Number, I: Number, N: Number, S: Number,
        T: Number, F: Number, J: Number, P: Number,
        red: Number, yellow: Number, green: Number, blue: Number
    },
    
    timestamp: { type: Date, default: Date.now }
});

// 驗證邏輯：至少要有 email 或 guestId 其中一個
testRecordSchema.pre('save', function(next) {
    if (this.sourceRecordId && !this.adminId) return next(new Error('舊紀錄複本必須屬於管理員'));
    if (this.adminId && (this.userId || this.guestId || this.email)) return next(new Error('管理員測驗紀錄必須使用獨立身分'));
    if (!this.email && !this.guestId && !this.adminId) {
        return next(new Error('至少需要提供 email 或 guestId'));
    }
    next();
});

// 添加索引以提高查詢性能
testRecordSchema.index({ userId: 1, timestamp: -1 });
testRecordSchema.index({ adminId: 1, timestamp: -1 });
testRecordSchema.index({ adminId: 1, sourceRecordId: 1 }, { unique: true, partialFilterExpression: { adminId: { $type: 'objectId' }, sourceRecordId: { $type: 'objectId' } } });
testRecordSchema.index({ email: 1, timestamp: -1 });
testRecordSchema.index({ guestId: 1, timestamp: -1 }); // 新增訪客 ID 索引

const TestRecord = mongoose.model('TestRecord', testRecordSchema);
module.exports = TestRecord;
