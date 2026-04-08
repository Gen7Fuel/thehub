const mongoose = require('mongoose');

const bulletinPostSchema = new mongoose.Schema(
  {
    site: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    author: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BulletinPost', bulletinPostSchema);
