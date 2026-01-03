import { Types } from 'mongoose';
import { User } from '../../models/User';
import { BaseSyncAdapter, SyncableDocument } from './BaseSyncAdapter';
import {
  UserSyncRecord,
  EntityChanges,
  SyncContext,
  ApplyResult,
} from '../types/sync.types';

interface UserDocument extends SyncableDocument {
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  deletedAt?: Date | null;
}

export class UserSyncAdapter extends BaseSyncAdapter<UserSyncRecord, UserDocument> {
  readonly entityName = 'users';
  protected readonly model = User as any;

  async getChangesSince(ctx: SyncContext): Promise<EntityChanges<UserSyncRecord>> {
    const since = ctx.lastPulledAt ? new Date(ctx.lastPulledAt) : null;
    
    const query: any = { _id: ctx.userId };
    if (since) {
      query.updatedAt = { $gt: since };
    }

    const user = await User.findOne(query);

    if (!user) {
      return { created: [], updated: [], deleted: [] };
    }

    const record = this.toSyncRecord(user as unknown as UserDocument);

    if (!ctx.lastPulledAt) {
      return { created: [record], updated: [], deleted: [] };
    }

    if (user.deletedAt) {
      return { created: [], updated: [], deleted: [user._id.toString()] };
    }

    return { created: [], updated: [record], deleted: [] };
  }

  override async applyChanges(
    ctx: SyncContext,
    changes: EntityChanges<UserSyncRecord>
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
    };

    for (const record of changes.updated) {
      try {
        const user = await User.findById(ctx.userId);

        if (!user) {
          result.conflicts.push({
            clientId: record.clientId,
            reason: 'not_found',
          });
          continue;
        }

        if (user.deletedAt) {
          result.conflicts.push({
            clientId: record.clientId,
            serverId: user._id.toString(),
            reason: 'already_deleted',
          });
          continue;
        }

        const serverUpdatedAt = user.updatedAt.getTime();
        if (serverUpdatedAt > record.updatedAt) {
          result.conflicts.push({
            clientId: record.clientId,
            serverId: user._id.toString(),
            reason: 'server_newer',
          });
          continue;
        }

        if (record.firstName !== undefined) {
          user.firstName = record.firstName;
        }
        if (record.lastName !== undefined) {
          user.lastName = record.lastName;
        }

        await user.save();
        result.updated.push(record.clientId);
      } catch (error) {
        console.error('Failed to update user:', error);
      }
    }

    return result;
  }

  protected toSyncRecord(doc: UserDocument): UserSyncRecord {
    return {
      clientId: doc._id.toString(),
      firstName: doc.firstName,
      lastName: doc.lastName,
      name: doc.name,
      updatedAt: doc.updatedAt.getTime(),
      deletedAt: doc.deletedAt ? doc.deletedAt.getTime() : null,
    };
  }

  protected toDocumentFields(
    record: UserSyncRecord,
    _userId: Types.ObjectId
  ): Partial<UserDocument> {
    return {
      firstName: record.firstName,
      lastName: record.lastName,
    };
  }
}

export const userSyncAdapter = new UserSyncAdapter();

