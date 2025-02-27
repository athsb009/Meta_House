const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  // Set default to undefined so that if no username is provided, the field is not inserted.
  username: {
    type: String,
    unique: true,
    sparse: true,
  },
  avatar: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to hash the password before saving the user document
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare candidate password with the stored hash
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
