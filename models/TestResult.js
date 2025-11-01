const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
    testName: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    answers: {
        type: Array,
        required: true
    },
    result: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TestResult', testResultSchema); 