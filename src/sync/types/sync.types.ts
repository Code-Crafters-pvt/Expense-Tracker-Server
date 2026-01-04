import { Types } from 'mongoose';

export interface SyncableRecord {
  clientId: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface UserSyncRecord extends SyncableRecord {
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface EntityChanges<T = SyncableRecord> {
  created: T[];
  updated: T[];
  deleted: string[];
}

export interface SyncChanges {
  users?: EntityChanges<UserSyncRecord>;
  [entityName: string]: EntityChanges | undefined;
}

export interface SyncRequest {
  lastPulledAt: number | null;
  changes: SyncChanges;
}

export interface SyncResponse {
  changes: SyncChanges;
  timestamp: number;
}

export interface SyncContext {
  userId: Types.ObjectId;
  lastPulledAt: number | null;
  currentTimestamp: number;
}

export interface ISyncAdapter<T extends SyncableRecord = SyncableRecord> {
  readonly entityName: string;
  
  getChangesSince(ctx: SyncContext): Promise<EntityChanges<T>>;
  applyChanges(ctx: SyncContext, changes: EntityChanges<T>): Promise<ApplyResult>;
}

export interface ApplyResult {
  created: Array<{ clientId: string; serverId: string }>;
  updated: string[];
  deleted: string[];
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  clientId: string;
  serverId?: string;
  reason: 'server_newer' | 'not_found' | 'already_deleted';
}

