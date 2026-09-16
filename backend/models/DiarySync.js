const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Diary' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pgVersion: String,
  difyVersion: String,
  difySubmittedVersion: String,
  difyDocId: String,
  difyDatasetId: String,
  difyBaseUrl: String
}, { timestamps: true });
schema.index({ user: 1 });
module.exports = mongoose.model('DiarySync', schema);
