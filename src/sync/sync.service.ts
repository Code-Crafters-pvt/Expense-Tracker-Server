import { Types } from 'mongoose';
import { adapterRegistry } from './adapters';
import {
  SyncRequest,
  SyncResponse,
  SyncChanges,
  SyncContext,
  EntityChanges,
} from './types/sync.types';

export class SyncService {
  async sync(userId: Types.ObjectId, request: SyncRequest): Promise<SyncResponse> {
    const currentTimestamp = Date.now();

    const ctx: SyncContext = {
      userId,
      lastPulledAt: request.lastPulledAt,
      currentTimestamp,
    };

    const responseChanges: SyncChanges = {};

    await this.processPush(ctx, request.changes);
    await this.processPull(ctx, responseChanges);

    return {
      changes: responseChanges,
      timestamp: currentTimestamp,
    };
  }

  private async processPush(ctx: SyncContext, changes: SyncChanges): Promise<void> {
    const adapters = adapterRegistry.getAll();

    for (const adapter of adapters) {
      const entityChanges = changes[adapter.entityName];
      
      if (!entityChanges) {
        continue;
      }

      if (this.hasChanges(entityChanges)) {
        await adapter.applyChanges(ctx, entityChanges);
      }
    }
  }

  private async processPull(ctx: SyncContext, responseChanges: SyncChanges): Promise<void> {
    const adapters = adapterRegistry.getAll();

    for (const adapter of adapters) {
      const changes = await adapter.getChangesSince(ctx);
      
      if (this.hasChanges(changes)) {
        responseChanges[adapter.entityName] = changes;
      }
    }
  }

  private hasChanges(changes: EntityChanges): boolean {
    return (
      changes.created.length > 0 ||
      changes.updated.length > 0 ||
      changes.deleted.length > 0
    );
  }
}

export const syncService = new SyncService();

