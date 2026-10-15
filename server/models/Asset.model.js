import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'clientId is required for Asset'],
      index: true,
    },
    url: {
      type: String,
      required: [true, 'url is required for Asset'],
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    width: {
      type: Number,
      default: 0,
      min: 0,
    },
    height: {
      type: Number,
      default: 0,
      min: 0,
    },
    bytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: false }
);

assetSchema.index({ clientId: 1, createdAt: -1 });

const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

export default Asset;
