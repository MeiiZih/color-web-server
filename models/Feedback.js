const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    description: { type: String, required: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
