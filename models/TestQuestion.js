const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionNumber: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true }
});

const testQuestionSchema = new mongoose.Schema({
    testType: { type: String, required: true, trim: true, unique: true },
    totalQuestions: { type: Number, required: true },
    questions: { type: [questionSchema], required: true },
    description: { type: String }, // 新增說明欄位
    imgUrl: { type: String }, // 新增圖片URL欄位
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 更新 updatedAt 時間戳
testQuestionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('TestQuestion', testQuestionSchema);
