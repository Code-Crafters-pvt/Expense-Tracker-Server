import { ISyncAdapter, SyncableRecord } from '../types/sync.types';
import { userSyncAdapter } from './UserSyncAdapter';

class AdapterRegistry {
  private adapters: Map<string, ISyncAdapter> = new Map();

  register<T extends SyncableRecord>(adapter: ISyncAdapter<T>): void {
    this.adapters.set(adapter.entityName, adapter as ISyncAdapter);
  }

  get(entityName: string): ISyncAdapter | undefined {
    return this.adapters.get(entityName);
  }

  getAll(): ISyncAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(entityName: string): boolean {
    return this.adapters.has(entityName);
  }

  getEntityNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();

adapterRegistry.register(userSyncAdapter);

export { BaseSyncAdapter } from './BaseSyncAdapter';
export { UserSyncAdapter, userSyncAdapter } from './UserSyncAdapter';

