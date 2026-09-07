const mongoose = require('mongoose');
// Anonymous, self-reported feedback. No answers, contact information, or raw capability key.
module.exports = mongoose.model('ResultFeedback', new mongoose.Schema({
  keyHash: { type: String, required: true, unique: true },
  surveyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  choice: { type: String, enum: ['red','yellow','green','blue','none','other'], required: true },
  text: { type: String, maxlength: 500 },
  updatedAt: { type: Date, required: true }
}));
