# Schema Checkpoint: Append-Only Enforcement

**Date:** February 6, 2026  
**Version:** 1aeba49c  
**Status:** Schema Updated, Constraints Ready for Manual Application

---

## Summary

This checkpoint captures the database schema updates and constraint definitions for append-only enforcement and manager override semantics. The schema changes are complete; the triggers and constraints are ready for manual application.

---

## Schema Changes (Completed)

### 1. Media Table
**File:** `drizzle/schema.ts` (lines 267-284)

**New Column:**
```typescript
isVoided: boolean("is_voided").notNull().default(false),  // Soft-void flag
```

**Purpose:** Mark photos/videos as voided without deleting them (audit trail preserved)

### 2. Invoice Line Items Table
**File:** `drizzle/schema.ts` (lines 386-403)

**New Columns:**
```typescript
isVoided: boolean("is_voided").notNull().default(false),  // Soft-void flag
voidReason: text("void_reason"),                           // Why voided
voidedAt: timestamp("voided_at"),                          // When voided
```

**Purpose:** Mark line items as voided without deleting them (audit trail preserved)

### 3. Cleaning Jobs Table
**File:** `drizzle/schema.ts` (line 200)

**New Column:**
```typescript
overrideStatus: varchar("override_status", { length: 50 }),  // "completed" or "needs_review"
```

**Purpose:** Explicit status after manager override

### 4. Media Void Audit Table
**File:** `drizzle/schema.ts` (lines 412-428)

**New Table:**
```typescript
export const mediaVoidAudit = mysqlTable("media_void_audit", {
  id: varchar(...).primaryKey(),
  mediaId: varchar(...).notNull(),
  jobId: varchar(...).notNull(),
  voidReason: text(...).notNull(),
  voidedBy: varchar(...).notNull(),  // User ID
  voidedAt: timestamp(...).defaultNow(),
  createdAt: timestamp(...).defaultNow(),
});
```

**Purpose:** Audit trail for voided media records

### 5. Invoice Line Item Void Audit Table
**File:** `drizzle/schema.ts` (lines 433-450)

**New Table:**
```typescript
export const invoiceLineItemVoidAudit = mysqlTable("invoice_line_item_void_audit", {
  id: varchar(...).primaryKey(),
  lineItemId: varchar(...).notNull(),
  invoiceId: varchar(...).notNull(),
  jobId: varchar(...).notNull(),
  voidReason: text(...).notNull(),
  voidedBy: varchar(...).notNull(),  // User ID
  voidedAt: timestamp(...).defaultNow(),
  createdAt: timestamp(...).defaultNow(),
});
```

**Purpose:** Audit trail for voided invoice line items

---

## Constraints & Triggers (Ready for Manual Application)

**File:** `drizzle/migrations/0002_append_only_constraints.sql`

### Triggers to Apply

1. **media_prevent_update** — Prevent UPDATE on media (except is_voided)
2. **media_prevent_delete** — Prevent DELETE on media
3. **invoice_line_items_prevent_update** — Prevent UPDATE on invoice_line_items
4. **invoice_line_items_prevent_delete** — Prevent DELETE on invoice_line_items
5. **invoices_prevent_amount_update** — Prevent totalAmount UPDATE on submitted invoices
6. **override_reason_required** — Enforce override reason and status are set

### Unique Constraints to Apply

1. **unique_open_invoice_per_cleaner** — Only one open invoice per cleaner

---

## Application Status

### What's Ready
- ✅ Schema changes applied (Drizzle ORM)
- ✅ TypeScript types updated
- ✅ SQL migration file generated
- ✅ Documentation complete

### What's Pending
- ⏳ Apply SQL triggers manually (not auto-applied by Drizzle)
- ⏳ Apply unique constraint manually
- ⏳ Update application logic to use soft-void procedures
- ⏳ Test constraint enforcement

---

## How to Apply Constraints

### Option 1: Manual SQL Execution
```bash
# Connect to database
mysql -u user -p database

# Run migration file
source drizzle/migrations/0002_append_only_constraints.sql;
```

### Option 2: Using MySQL Client
```bash
mysql -u user -p database < drizzle/migrations/0002_append_only_constraints.sql
```

### Option 3: Verify Triggers After Application
```sql
-- Check all triggers
SELECT TRIGGER_NAME, TRIGGER_SCHEMA, ACTION_STATEMENT 
FROM INFORMATION_SCHEMA.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE();

-- Check unique constraint
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE CONSTRAINT_NAME = 'unique_open_invoice_per_cleaner';
```

---

## Testing Constraints

### Test 1: Media Immutability
```sql
-- This should FAIL with "Media records are immutable"
UPDATE media SET uri = 'new_url' WHERE id = 'media_123';

-- This should SUCCEED (soft-void)
UPDATE media SET is_voided = TRUE WHERE id = 'media_123';

-- This should FAIL with "Media records cannot be deleted"
DELETE FROM media WHERE id = 'media_123';
```

### Test 2: Invoice Line Item Immutability
```sql
-- This should FAIL with "Invoice line items are immutable"
UPDATE invoice_line_items SET price = 100 WHERE id = 'ili_123';

-- This should SUCCEED (soft-void)
UPDATE invoice_line_items SET is_voided = TRUE, void_reason = 'Duplicate', voided_at = NOW() WHERE id = 'ili_123';

-- This should FAIL with "Invoice line items cannot be deleted"
DELETE FROM invoice_line_items WHERE id = 'ili_123';
```

### Test 3: Override Semantics
```sql
-- This should FAIL (missing override_reason)
UPDATE cleaning_jobs 
SET overridden_by = 'user_123', overridden_at = NOW(), override_status = 'completed'
WHERE id = 'job_123';

-- This should SUCCEED (all required fields)
UPDATE cleaning_jobs 
SET overridden_by = 'user_123', override_reason = 'Manager verified location', overridden_at = NOW(), override_status = 'completed'
WHERE id = 'job_123';
```

### Test 4: One Open Invoice Per Cleaner
```sql
-- This should FAIL (second open invoice for same cleaner)
INSERT INTO invoices (id, business_id, cleaner_id, status, cycle, period_start, period_end, total_amount)
VALUES ('inv_456', 'biz_123', 'cleaner_123', 'open', 'bi_weekly', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 500);

-- (Assuming cleaner_123 already has an open invoice)
```

---

## Soft-Void Procedures (Ready for Implementation)

**File:** `docs/APPEND_ONLY_ENFORCEMENT.md` (Section 2 & 3)

### Procedure: void_media
```sql
CALL void_media(
  'media_123',                    -- Media ID
  'Photo is blurry',              -- Reason
  'user_456'                      -- Manager ID
);
```

### Procedure: void_invoice_line_item
```sql
CALL void_invoice_line_item(
  'ili_123',                      -- Line Item ID
  'Duplicate job entry',          -- Reason
  'user_456'                      -- Manager ID
);
```

---

## Rollback Instructions

If you need to remove the constraints:

```sql
DROP TRIGGER IF EXISTS media_prevent_update;
DROP TRIGGER IF EXISTS media_prevent_delete;
DROP TRIGGER IF EXISTS invoice_line_items_prevent_update;
DROP TRIGGER IF EXISTS invoice_line_items_prevent_delete;
DROP TRIGGER IF EXISTS invoices_prevent_amount_update;
DROP TRIGGER IF EXISTS override_reason_required;
ALTER TABLE invoices DROP KEY unique_open_invoice_per_cleaner;
```

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `drizzle/schema.ts` | Added is_voided, void_reason, voided_at, override_status fields | ✅ Complete |
| `drizzle/schema.ts` | Added mediaVoidAudit, invoiceLineItemVoidAudit tables | ✅ Complete |
| `drizzle/migrations/0002_append_only_constraints.sql` | SQL triggers and constraints | ✅ Ready |
| `docs/APPEND_ONLY_ENFORCEMENT.md` | Complete documentation | ✅ Complete |
| `SCHEMA_CHECKPOINT.md` | This file | ✅ Complete |

---

## Next Steps

1. **Apply constraints** — Run `0002_append_only_constraints.sql` manually
2. **Test enforcement** — Verify triggers prevent UPDATE/DELETE
3. **Implement soft-void procedures** — Create API endpoints to call stored procedures
4. **Update application logic** — Exclude voided records from queries
5. **Test soft-void** — Verify audit trails are created

---

## Documentation References

- **Append-Only Enforcement Details:** `docs/APPEND_ONLY_ENFORCEMENT.md`
- **Manager Override Semantics:** `docs/APPEND_ONLY_ENFORCEMENT.md` (Section 5)
- **Code Audit Report:** `CODE_AUDIT_REPORT.md`
- **Technical Review:** `TECHNICAL_REVIEW.md`

---

**Checkpoint Version:** 1aeba49c  
**Status:** Schema Complete, Constraints Ready for Manual Application  
**Next Action:** Apply SQL migration file to database
