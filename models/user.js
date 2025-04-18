const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, 
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
