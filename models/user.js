const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  mobileNo: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, 
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpiry: { type: Date }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
