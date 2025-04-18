const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
});

const Balance = mongoose.model('Balance', balanceSchema);

module.exports = Balance;
