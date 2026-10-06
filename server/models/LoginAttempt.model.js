import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    ip: { type: String, required: true, trim: true },
    failedAttempts: { type: Number, default: 0 },
    windowStartedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

loginAttemptSchema.index({ email: 1, ip: 1 }, { unique: true });
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginAttempt =
  mongoose.models.LoginAttempt || mongoose.model('LoginAttempt', loginAttemptSchema);

export default LoginAttempt;
