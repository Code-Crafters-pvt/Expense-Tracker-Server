import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../enums/UserRole';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  name?: string; // Computed field for backward compatibility
  email?: string; // Optional for offline users
  password?: string; // Optional for offline users
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  tokenVersion: number;
  lastLoginAt?: Date;
  
  // Offline user fields
  isOfflineUser: boolean;
  offlineId?: string; // Unique identifier for offline users
  syncStatus: 'offline' | 'pending_sync' | 'synced';
  
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [25, 'First name cannot be more than 25 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [25, 'Last name cannot be more than 25 characters'],
    },
    name: {
      type: String,
      required: false, // Computed field
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: false, // Optional for offline users
      unique: true,
      sparse: true, // Allow multiple nulls
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    password: {
      type: String,
      required: false, // Optional for offline users
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: true, // Default true for existing users, will be false for new registrations with email verification
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
    },
    
    // Offline user fields
    isOfflineUser: {
      type: Boolean,
      default: false,
      index: true,
    },
    offlineId: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Allow multiple nulls
      index: true,
    },
    syncStatus: {
      type: String,
      enum: ['offline', 'pending_sync', 'synced'],
      default: 'offline',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (
        doc,
        ret: { password?: string } & Record<string, any>
      ) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Compute name field and hash password before saving
userSchema.pre('save', async function (next) {
  // Compute name from firstName and lastName
  if (this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`;
  }

  // Hash password only if it exists and is modified
  if (this.password && this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(
        parseInt(process.env.BCRYPT_ROUNDS || '12')
      );
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error as Error);
    }
  }

  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    // For offline users without password, perform a dummy bcrypt comparison
    // to prevent timing attacks that could reveal password existence
    const dummyHash = '$2a$10$dummy.hash.to.prevent.timing.attacks';
    await bcrypt.compare(candidatePassword, dummyHash);
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};


export const User = mongoose.model<IUser>('User', userSchema);
