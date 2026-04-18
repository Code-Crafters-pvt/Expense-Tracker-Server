import { Model, Document, Types } from 'mongoose';
import {
  ISyncAdapter,
  SyncableRecord,
  EntityChanges,
  SyncContext,
  ApplyResult,
} from '../types/sync.types';

export interface SyncableDocument extends Document {
  _id: Types.ObjectId;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export abstract class BaseSyncAdapter<
  TRecord extends SyncableRecord,
  TDocument extends SyncableDocument
> implements ISyncAdapter<TRecord> {
  abstract readonly entityName: string;
  protected abstract readonly model: Model<TDocument>;

  abstract getChangesSince(ctx: SyncContext): Promise<EntityChanges<TRecord>>;

  protected abstract toSyncRecord(doc: TDocument): TRecord;

  protected abstract toDocumentFields(
    record: TRecord,
    userId: Types.ObjectId
  ): Partial<TDocument>;

  async applyChanges(
    ctx: SyncContext,
    changes: EntityChanges<TRecord>
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
    };

    await this.processCreated(ctx, changes.created, result);
    await this.processUpdated(ctx, changes.updated, result);
    await this.processDeleted(ctx, changes.deleted, result);

    return result;
  }

  protected async processCreated(
    ctx: SyncContext,
    records: TRecord[],
    result: ApplyResult
  ): Promise<void> {
    for (const record of records) {
      try {
        const existing = await this.findByClientId(record.clientId, ctx.userId);

        if (existing) {
          result.conflicts.push({
            clientId: record.clientId,
            serverId: existing._id.toString(),
            reason: 'server_newer',
          });
          continue;
        }

        const fields = this.toDocumentFields(record, ctx.userId);
        const doc = new this.model({
          ...fields,
          clientId: record.clientId,
        });

        await doc.save();

        result.created.push({
          clientId: record.clientId,
          serverId: doc._id.toString(),
        });
      } catch (error) {
        console.error(`Failed to create ${this.entityName}:`, error);
      }
    }
  }

  protected async processUpdated(
    ctx: SyncContext,
    records: TRecord[],
    result: ApplyResult
  ): Promise<void> {
    for (const record of records) {
      try {
        const existing = await this.findByClientId(record.clientId, ctx.userId);

        if (!existing) {
          result.conflicts.push({
            clientId: record.clientId,
            reason: 'not_found',
          });
          continue;
        }

        if (existing.deletedAt) {
          result.conflicts.push({
            clientId: record.clientId,
            serverId: existing._id.toString(),
            reason: 'already_deleted',
          });
          continue;
        }

        const serverUpdatedAt = existing.updatedAt.getTime();
        if (serverUpdatedAt > record.updatedAt) {
          result.conflicts.push({
            clientId: record.clientId,
            serverId: existing._id.toString(),
            reason: 'server_newer',
          });
          continue;
        }

        const fields = this.toDocumentFields(record, ctx.userId);
        Object.assign(existing, fields);
        await existing.save();

        result.updated.push(record.clientId);
      } catch (error) {
        console.error(`Failed to update ${this.entityName}:`, error);
      }
    }
  }

  protected async processDeleted(
    ctx: SyncContext,
    clientIds: string[],
    result: ApplyResult
  ): Promise<void> {
    for (const clientId of clientIds) {
      try {
        const existing = await this.findByClientId(clientId, ctx.userId);

        if (!existing) {
          result.conflicts.push({
            clientId,
            reason: 'not_found',
          });
          continue;
        }

        if (!existing.deletedAt) {
          existing.deletedAt = new Date();
          await existing.save();
        }

        result.deleted.push(clientId);
      } catch (error) {
        console.error(`Failed to delete ${this.entityName}:`, error);
      }
    }
  }

  protected async findByClientId(
    clientId: string,
    userId: Types.ObjectId
  ): Promise<TDocument | null> {
    return this.model.findOne({
      clientId,
      userId,
    } as any);
  }

  protected async getModifiedSince(
    userId: Types.ObjectId,
    since: Date | null
  ): Promise<TDocument[]> {
    const query: any = { userId };

    if (since) {
      query.updatedAt = { $gt: since };
    }

    return this.model.find(query).exec();
  }

  protected categorizeChanges(
    docs: TDocument[],
    lastPulledAt: number | null
  ): EntityChanges<TRecord> {
    const changes: EntityChanges<TRecord> = {
      created: [],
      updated: [],
      deleted: [],
    };

    for (const doc of docs) {
      const record = this.toSyncRecord(doc);

      if (doc.deletedAt) {
        changes.deleted.push(doc.clientId || doc._id.toString());
      } else if (!lastPulledAt || doc.createdAt.getTime() > lastPulledAt) {
        changes.created.push(record);
      } else {
        changes.updated.push(record);
      }
    }

    return changes;
  }
}

