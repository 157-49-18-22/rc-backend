// models/hitLog.model.js
const mongoose = require('mongoose');

const hitLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HitLog', hitLogSchema);