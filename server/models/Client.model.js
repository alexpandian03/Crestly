import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: [120, 'Client name cannot exceed 120 characters'],
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'starter',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /* How this organization's posters may be made. At least one stays on: the service that
       checks this is the settings route, because a poster needs one of them. */
    designModes: {
      ai: {
        type: Boolean,
        default: true,
      },
      templates: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Transform JSON output
clientSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

export default Client;
