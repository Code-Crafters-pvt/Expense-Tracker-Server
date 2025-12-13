import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../enums/UserRole';
import { AccountStatus } from '../enums/AccountStatus';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  deactivatedAt?: Date;
  scheduledDeletionDate?: Date;
  tokenVersion: number;
  lastLoginAt?: Date;
  
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
      required: false,
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
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
    accountStatus: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.PENDING_VERIFICATION,
      required: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false, // Don't include in queries by default
    },
    emailVerificationExpires: {
      type: Date,
    },
    deactivatedAt: {
      type: Date,
    },
    scheduledDeletionDate: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
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

userSchema.pre('save', async function (next) {
  this.name = [this.firstName, this.lastName].filter(Boolean).join(' ').trim();

  if (this.isModified('accountStatus') || this.isNew) {
    this.isEmailVerified = this.accountStatus === AccountStatus.ACTIVE;
  }

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
  return bcrypt.compare(candidatePassword, this.password);
};


export const User = mongoose.model<IUser>('User', userSchema);
