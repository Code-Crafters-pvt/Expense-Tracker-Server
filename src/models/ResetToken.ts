import mongoose, { Document, Schema } from 'mongoose';

export interface IResetToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const resetTokenSchema = new Schema<IResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired tokens after 24 hours
resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const ResetToken = mongoose.model<IResetToken>(
  'ResetToken',
  resetTokenSchema
);