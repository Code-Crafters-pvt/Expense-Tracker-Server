# How to Add Sync for a New Entity

This guide shows you how to add sync support using **Expense** as an example.

---

## What Each File/Folder Does

### `sync/` - Main sync folder
- `sync.routes.ts` - Defines the `/api/sync` endpoint
- `sync.controller.ts` - Handles HTTP requests
- `sync.service.ts` - Loops through all adapters and processes sync
- `sync.validation.ts` - Validates request data

### `sync/adapters/` - Entity-specific sync logic
- `BaseSyncAdapter.ts` - Template that all adapters extend
- `UserSyncAdapter.ts` - Example adapter (for user profile)
- `index.ts` - Registry where you register your adapter

### `sync/types/` - Type definitions
- `sync.types.ts` - Defines what data structures look like

---

## Step-by-Step: Adding Expense Sync

### Step 1: Update Expense Model

Add these fields to your `Expense` model in `src/models/Expense.ts`:

```typescript
const expenseSchema = new Schema({
  clientId: { type: String, index: true },  // WatermelonDB's local ID
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: Number,
  description: String,
  category: String,
  date: Date,
  deletedAt: { type: Date, default: null },  // For soft delete
}, { timestamps: true });  // This adds createdAt and updatedAt

// Add index for sync queries
expenseSchema.index({ updatedAt: 1 });
```

**Why:** Sync needs `clientId` to map local records, `userId` to filter by user, and `deletedAt` for soft deletes.

---

### Step 2: Add Expense Record Type

Open `src/sync/types/sync.types.ts` and add:

```typescript
export interface ExpenseSyncRecord extends SyncableRecord {
  amount: number;
  description: string;
  category: string;
  date: number;  // Timestamp in milliseconds
}
```

**Why:** This defines what an Expense record looks like when syncing. `SyncableRecord` already includes `clientId`, `updatedAt`, `deletedAt`.

---

### Step 3: Create Expense Adapter

Create new file: `src/sync/adapters/ExpenseSyncAdapter.ts`

```typescript
import { Types } from 'mongoose';
import { Expense } from '../../models/Expense';
import { BaseSyncAdapter, SyncableDocument } from './BaseSyncAdapter';
import {
  ExpenseSyncRecord,
  EntityChanges,
  SyncContext,
} from '../types/sync.types';

interface ExpenseDocument extends SyncableDocument {
  amount: number;
  description: string;
  category: string;
  date: Date;
  userId: Types.ObjectId;
  deletedAt?: Date | null;
}

export class ExpenseSyncAdapter extends BaseSyncAdapter<ExpenseSyncRecord, ExpenseDocument> {
  readonly entityName = 'expenses';
  protected readonly model = Expense as any;

  // PULL: Get expenses changed since lastPulledAt
  async getChangesSince(ctx: SyncContext): Promise<EntityChanges<ExpenseSyncRecord>> {
    const since = ctx.lastPulledAt ? new Date(ctx.lastPulledAt) : null;
    
    const query: any = { userId: ctx.userId };
    if (since) {
      query.updatedAt = { $gt: since };
    }

    const expenses = await Expense.find(query).exec();

    if (expenses.length === 0) {
      return { created: [], updated: [], deleted: [] };
    }

    const changes: EntityChanges<ExpenseSyncRecord> = {
      created: [],
      updated: [],
      deleted: [],
    };

    for (const expense of expenses) {
      const record = this.toSyncRecord(expense as unknown as ExpenseDocument);

      if (expense.deletedAt) {
        changes.deleted.push(expense.clientId || expense._id.toString());
      } else if (!ctx.lastPulledAt) {
        changes.created.push(record);
      } else {
        changes.updated.push(record);
      }
    }

    return changes;
  }

  // Convert MongoDB document → Sync record
  protected toSyncRecord(doc: ExpenseDocument): ExpenseSyncRecord {
    return {
      clientId: doc.clientId || doc._id.toString(),
      amount: doc.amount,
      description: doc.description,
      category: doc.category,
      date: doc.date.getTime(),
      updatedAt: doc.updatedAt.getTime(),
      deletedAt: doc.deletedAt ? doc.deletedAt.getTime() : null,
    };
  }

  // Convert Sync record → MongoDB fields
  protected toDocumentFields(
    record: ExpenseSyncRecord,
    userId: Types.ObjectId
  ): Partial<ExpenseDocument> {
    return {
      amount: record.amount,
      description: record.description,
      category: record.category,
      date: new Date(record.date),
      userId: userId,
    };
  }
}

export const expenseSyncAdapter = new ExpenseSyncAdapter();
```

**What each method does:**
- `getChangesSince()` - Finds expenses modified since last sync, returns them
- `toSyncRecord()` - Converts MongoDB expense → format client expects
- `toDocumentFields()` - Converts client expense → format MongoDB expects

**Note:** `applyChanges()` is provided by `BaseSyncAdapter` - you don't need to write it!

---

### Step 4: Register Adapter

Open `src/sync/adapters/index.ts` and add:

```typescript
import { expenseSyncAdapter } from './ExpenseSyncAdapter';

// ... existing code ...

adapterRegistry.register(expenseSyncAdapter);
```

**Why:** The registry tells the sync service to include your adapter. Without this, sync won't work.

---

## That's It!

Now when client calls `POST /api/sync`, expenses will automatically sync.

### How It Works:

1. Client sends expenses in `changes.expenses`
2. `sync.service.ts` loops through all registered adapters
3. Finds `expenseSyncAdapter` (because `entityName = 'expenses'`)
4. Calls `expenseSyncAdapter.applyChanges()` to save client's expenses
5. Calls `expenseSyncAdapter.getChangesSince()` to get server's expenses
6. Returns both in response

---

## Testing

### Test Pull (Get expenses from server):

```bash
POST /api/sync
{
  "lastPulledAt": null,
  "changes": {}
}
```

Response should include:
```json
{
  "data": {
    "changes": {
      "expenses": {
        "created": [...],
        "updated": [],
        "deleted": []
      }
    }
  }
}
```

### Test Push (Send expenses to server):

```bash
POST /api/sync
{
  "lastPulledAt": 1699500000,
  "changes": {
    "expenses": {
      "created": [{
        "clientId": "wm_001",
        "amount": 50,
        "description": "Lunch",
        "category": "Food",
        "date": 1699600000,
        "updatedAt": 1699600000
      }],
      "updated": [],
      "deleted": []
    }
  }
}
```

Should create expense in database.

---

## Checklist

Before you're done:

- [ ] Expense model has `clientId`, `userId`, `deletedAt` fields
- [ ] Expense model has index on `updatedAt`
- [ ] Added `ExpenseSyncRecord` to `sync.types.ts`
- [ ] Created `ExpenseSyncAdapter.ts` with all 3 methods
- [ ] Registered adapter in `adapters/index.ts`
- [ ] Tested pull (server → client)
- [ ] Tested push (client → server)

---

## Need Help?

Look at `UserSyncAdapter.ts` - it's a working example. Your Expense adapter will be similar, just simpler (User adapter is special because it queries by `_id` instead of `userId`).

