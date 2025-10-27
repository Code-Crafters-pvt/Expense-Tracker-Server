import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string; // Hashed token
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for static methods
export interface IRefreshTokenModel extends Model<IRefreshToken> {
  hashToken(token: string): string;
  createRefreshToken(
    userId: mongoose.Types.ObjectId,
    token: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IRefreshToken>;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
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
    deviceInfo: {
      type: String,
      default: 'Unknown Device',
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

// Auto-delete expired tokens after they expire
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to hash tokens before storing
refreshTokenSchema.statics.hashToken = function (token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method to create and store refresh token
refreshTokenSchema.statics.createRefreshToken = async function (
  userId: mongoose.Types.ObjectId,
  token: string,
  expiresAt: Date,
  deviceInfo?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<IRefreshToken> {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  return this.create({
    userId,
    token: hashedToken,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
    isRevoked: false,
  });
};

export const RefreshToken = mongoose.model<IRefreshToken, IRefreshTokenModel>(
  'RefreshToken',
  refreshTokenSchema
);

