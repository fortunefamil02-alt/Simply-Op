# Append-Only Enforcement & Manager Override Semantics

**Date:** February 6, 2026  
**Status:** Design Complete, Implementation Ready (Database Migration Pending)

---

## 1. Append-Only Enforcement Strategy

### Problem
Current implementation relies on application-level enforcement only. This creates risks:
- Accidental or malicious queries could modify/delete immutable records
- No database-level constraints to prevent violations
- Audit trail incomplete for corrections

### Solution: Database-Level Enforcement + Soft-Void

**Principle:** Records are immutable by default. Corrections use soft-void (logical deletion) with audit trail.

---

## 2. Media Table (Photos/Videos)

### Current Schema
```typescript
export const media = mysqlTable("media", {
  id: varchar(...).primaryKey(),
  jobId: varchar(...).notNull(),
  type: mediaTypeEnum.notNull(),  // "photo" | "video"
  uri: text(...).notNull(),
  room: varchar(...),
  isRequired: boolean(...).default(false),
  uploadedAt: timestamp(...).defaultNow(),
  createdAt: timestamp(...).defaultNow(),
});
```

### Updated Schema (Append-Only)
```typescript
export const media = mysqlTable("media", {
  id: varchar(...).primaryKey(),
  jobId: varchar(...).notNull(),
  type: mediaTypeEnum.notNull(),
  uri: text(...).notNull(),
  room: varchar(...),
  isRequired: boolean(...).default(false),
  uploadedAt: timestamp(...).defaultNow(),
  isVoided: boolean(...).notNull().default(false),  // ← NEW: Soft-void flag
  createdAt: timestamp(...).defaultNow(),
});
```

### Database Constraints

**Trigger: Prevent UPDATE (except is_voided)**
```sql
CREATE TRIGGER media_prevent_update BEFORE UPDATE ON media
FOR EACH ROW
BEGIN
  IF OLD.is_voided <> NEW.is_voided THEN
    -- Allow soft-void
    SET NEW.is_voided = NEW.is_voided;
  ELSE
    -- Reject any other UPDATE
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Media records are immutable. Use soft-void (is_voided=true) instead.';
  END IF;
END;
```

**Trigger: Prevent DELETE**
```sql
CREATE TRIGGER media_prevent_delete BEFORE DELETE ON media
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' 
  SET MESSAGE_TEXT = 'Media records cannot be deleted. Use soft-void (is_voided=true) instead.';
END;
```

### Audit Trail Table

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

### Soft-Void Procedure

```sql
DELIMITER //
CREATE PROCEDURE void_media(
  IN p_media_id VARCHAR(64),
  IN p_reason TEXT,
  IN p_voided_by VARCHAR(64)
)
BEGIN
  DECLARE v_job_id VARCHAR(64);
  
  -- Get job_id from media
  SELECT job_id INTO v_job_id FROM media WHERE id = p_media_id;
  
  IF v_job_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Media record not found.';
  END IF;
  
  -- Mark media as voided
  UPDATE media SET is_voided = TRUE WHERE id = p_media_id;
  
  -- Create audit record
  INSERT INTO media_void_audit (id, media_id, job_id, void_reason, voided_by)
  VALUES (
    CONCAT('mva_', UNIX_TIMESTAMP(), '_', SUBSTRING(MD5(RAND()), 1, 8)),
    p_media_id,
    v_job_id,
    p_reason,
    p_voided_by
  );
END //
DELIMITER ;
```

### Usage Example

**Void a photo (e.g., blurry photo):**
```sql
CALL void_media(
  'media_123',
  'Photo is blurry, uploading replacement',
  'user_456'  -- Manager ID
);
```

**Query active photos only:**
```sql
SELECT * FROM media WHERE job_id = 'job_123' AND is_voided = FALSE;
```

**Query void audit trail:**
```sql
SELECT * FROM media_void_audit WHERE job_id = 'job_123' ORDER BY voided_at DESC;
```

---

## 3. Invoice Line Items Table

### Current Schema
```typescript
export const invoiceLineItems = mysqlTable("invoice_line_items", {
  id: varchar(...).primaryKey(),
  invoiceId: varchar(...).notNull(),
  jobId: varchar(...).notNull(),
  price: decimal(...).notNull(),
  adjustedPrice: decimal(...),
  createdAt: timestamp(...).defaultNow(),
});
```

### Updated Schema (Append-Only)
```typescript
export const invoiceLineItems = mysqlTable("invoice_line_items", {
  id: varchar(...).primaryKey(),
  invoiceId: varchar(...).notNull(),
  jobId: varchar(...).notNull(),
  price: decimal(...).notNull(),
  adjustedPrice: decimal(...),
  isVoided: boolean(...).notNull().default(false),      // ← NEW: Soft-void flag
  voidReason: text(...),                                 // ← NEW: Why voided
  voidedAt: timestamp(...),                              // ← NEW: When voided
  createdAt: timestamp(...).defaultNow(),
});
```

### Database Constraints

**Trigger: Prevent UPDATE (any field)**
```sql
CREATE TRIGGER invoice_line_items_prevent_update BEFORE UPDATE ON invoice_line_items
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' 
  SET MESSAGE_TEXT = 'Invoice line items are immutable. Use soft-void (is_voided=true) instead.';
END;
```

**Trigger: Prevent DELETE**
```sql
CREATE TRIGGER invoice_line_items_prevent_delete BEFORE DELETE ON invoice_line_items
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' 
  SET MESSAGE_TEXT = 'Invoice line items cannot be deleted. Use soft-void (is_voided=true) instead.';
END;
```

### Audit Trail Table

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

### Soft-Void Procedure

```sql
DELIMITER //
CREATE PROCEDURE void_invoice_line_item(
  IN p_line_item_id VARCHAR(64),
  IN p_reason TEXT,
  IN p_voided_by VARCHAR(64)
)
BEGIN
  DECLARE v_invoice_id VARCHAR(64);
  DECLARE v_job_id VARCHAR(64);
  DECLARE v_price DECIMAL(10, 2);
  
  -- Get invoice_id and job_id from line item
  SELECT invoice_id, job_id, price INTO v_invoice_id, v_job_id, v_price
  FROM invoice_line_items WHERE id = p_line_item_id;
  
  IF v_invoice_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice line item not found.';
  END IF;
  
  -- Check if invoice is submitted (cannot void submitted invoices)
  IF (SELECT status FROM invoices WHERE id = v_invoice_id) = 'submitted' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot void line items from submitted invoices.';
  END IF;
  
  -- Mark line item as voided
  UPDATE invoice_line_items 
  SET is_voided = TRUE, void_reason = p_reason, voided_at = NOW()
  WHERE id = p_line_item_id;
  
  -- Update invoice total (subtract voided amount)
  UPDATE invoices 
  SET total_amount = total_amount - v_price, updated_at = NOW()
  WHERE id = v_invoice_id;
  
  -- Create audit record
  INSERT INTO invoice_line_item_void_audit (id, line_item_id, invoice_id, job_id, void_reason, voided_by)
  VALUES (
    CONCAT('ilva_', UNIX_TIMESTAMP(), '_', SUBSTRING(MD5(RAND()), 1, 8)),
    p_line_item_id,
    v_invoice_id,
    v_job_id,
    p_reason,
    p_voided_by
  );
END //
DELIMITER ;
```

### Usage Example

**Void a line item (e.g., duplicate job):**
```sql
CALL void_invoice_line_item(
  'ili_456',
  'Duplicate job entry, job was already invoiced',
  'user_789'  -- Manager ID
);
```

**Query active line items only:**
```sql
SELECT * FROM invoice_line_items WHERE invoice_id = 'inv_123' AND is_voided = FALSE;
```

**Query void audit trail:**
```sql
SELECT * FROM invoice_line_item_void_audit WHERE invoice_id = 'inv_123' ORDER BY voided_at DESC;
```

---

## 4. Invoice Immutability

### Current Schema
```typescript
export const invoices = mysqlTable("invoices", {
  id: varchar(...).primaryKey(),
  businessId: varchar(...).notNull(),
  cleanerId: varchar(...).notNull(),
  status: invoiceStatusEnum.notNull().default("open"),  // "open" | "submitted" | "approved" | "paid"
  invoiceCycle: invoiceCycleEnum.notNull().default("bi_weekly"),
  periodStart: timestamp(...).notNull(),
  periodEnd: timestamp(...).notNull(),
  totalAmount: decimal(...).notNull().default("0"),
  pdfUrl: text(...),
  submittedAt: timestamp(...),
  approvedAt: timestamp(...),
  paidAt: timestamp(...),
  createdAt: timestamp(...).defaultNow(),
  updatedAt: timestamp(...).defaultNow().onUpdateNow(),
});
```

### Database Constraints

**Trigger: Prevent totalAmount UPDATE on submitted invoices**
```sql
CREATE TRIGGER invoices_prevent_amount_update BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
  -- If invoice is submitted, prevent totalAmount changes
  IF OLD.status = 'submitted' AND OLD.total_amount <> NEW.total_amount THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Cannot modify invoice amount after submission.';
  END IF;
  
  -- If invoice is submitted, prevent status rollback
  IF OLD.status = 'submitted' AND NEW.status IN ('open', 'draft') THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Cannot revert submitted invoice to open/draft status.';
  END IF;
END;
```

**Unique Constraint: One open invoice per cleaner**
```sql
ALTER TABLE invoices ADD UNIQUE KEY unique_open_invoice_per_cleaner (
  cleaner_id,
  CASE WHEN status = 'open' THEN 1 ELSE NULL END
);
```

This allows:
- Multiple submitted/approved/paid invoices per cleaner
- Only ONE open invoice per cleaner at a time

---

## 5. Manager Override Semantics

### Problem
Current implementation allows overrides but lacks clarity on:
- What reason is required for override
- What status the job should be in after override
- How overrides are audited

### Solution: Explicit Override Semantics

### Updated Schema

```typescript
export const cleaningJobs = mysqlTable("cleaning_jobs", {
  // ... existing fields ...
  overriddenBy: varchar(...),                    // Manager ID
  overrideReason: text(...),                     // Required reason (NOT NULL if overriddenBy is set)
  overriddenAt: timestamp(...),                  // When override occurred
  overrideStatus: varchar(...),                  // ← NEW: "completed" or "needs_review"
  createdAt: timestamp(...).defaultNow(),
  updatedAt: timestamp(...).defaultNow().onUpdateNow(),
});
```

### Override Status Values

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `completed` | Manager force-completed the job | Job added to invoice immediately |
| `needs_review` | Manager flagged job for review | Job held pending manager approval |

### Database Constraints

**Trigger: Enforce override reason and status**
```sql
CREATE TRIGGER override_reason_required BEFORE UPDATE ON cleaning_jobs
FOR EACH ROW
BEGIN
  -- If overriddenBy is set, overrideReason must not be empty
  IF NEW.overridden_by IS NOT NULL AND (NEW.override_reason IS NULL OR NEW.override_reason = '') THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Override reason is required when overriding a job.';
  END IF;
  
  -- If overriddenBy is set, overriddenAt must be set
  IF NEW.overridden_by IS NOT NULL AND NEW.overridden_at IS NULL THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Override timestamp is required when overriding a job.';
  END IF;
  
  -- If overriddenBy is set, overrideStatus must be explicit
  IF NEW.overridden_by IS NOT NULL AND (NEW.override_status IS NULL OR NEW.override_status NOT IN ('completed', 'needs_review')) THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Override status must be explicit: "completed" or "needs_review".';
  END IF;
END;
```

### Override Scenarios

#### Scenario 1: GPS Validation Failed, Manager Verifies Location

**Conflict:** Cleaner marked job done but GPS was >50m from property

**Manager Action:** Override with `status='completed'` + `reason='Manager verified location on-site'`

**Result:** Job immediately added to invoice

```typescript
// Manager override endpoint
await tx.update(cleaningJobs)
  .set({
    status: "completed",
    overriddenBy: ctx.user.id,
    overrideReason: "Manager verified location on-site",
    overriddenAt: new Date(),
    overrideStatus: "completed",  // Force completion
    updatedAt: new Date(),
  })
  .where(eq(cleaningJobs.id, jobId));
```

#### Scenario 2: Missing Photos, Manager Reviews Job

**Conflict:** Cleaner marked job done but no photos uploaded

**Manager Action:** Override with `status='needs_review'` + `reason='Manager reviewing job without photos'`

**Result:** Job flagged for manual review, NOT added to invoice yet

```typescript
// Manager override endpoint
await tx.update(cleaningJobs)
  .set({
    status: "needs_review",
    overriddenBy: ctx.user.id,
    overrideReason: "Manager reviewing job without photos",
    overriddenAt: new Date(),
    overrideStatus: "needs_review",  // Flag for review
    updatedAt: new Date(),
  })
  .where(eq(cleaningJobs.id, jobId));
```

#### Scenario 3: Access Denied, Manager Approves Payment

**Conflict:** Guest was present, job marked as `accessDenied`, cleaner not paid

**Manager Action:** Override with `status='completed'` + `reason='Guest left, manager approves payment'`

**Result:** Job added to invoice, cleaner paid for attempted work

```typescript
// Manager override endpoint
await tx.update(cleaningJobs)
  .set({
    status: "completed",
    overriddenBy: ctx.user.id,
    overrideReason: "Guest left, manager approves payment",
    overriddenAt: new Date(),
    overrideStatus: "completed",
    updatedAt: new Date(),
  })
  .where(eq(cleaningJobs.id, jobId));
```

---

## 6. Implementation Checklist

### Phase 1: Database Schema (COMPLETE)
- [x] Add `is_voided` to media table
- [x] Add `is_voided`, `void_reason`, `voided_at` to invoice_line_items
- [x] Add `override_status` to cleaning_jobs
- [x] Create `mediaVoidAudit` table
- [x] Create `invoiceLineItemVoidAudit` table

### Phase 2: Database Constraints (READY)
- [ ] Create trigger: `media_prevent_update`
- [ ] Create trigger: `media_prevent_delete`
- [ ] Create trigger: `invoice_line_items_prevent_update`
- [ ] Create trigger: `invoice_line_items_prevent_delete`
- [ ] Create trigger: `invoices_prevent_amount_update`
- [ ] Create trigger: `override_reason_required`
- [ ] Create unique constraint: `unique_open_invoice_per_cleaner`

### Phase 3: Stored Procedures (READY)
- [ ] Create procedure: `void_media`
- [ ] Create procedure: `void_invoice_line_item`

### Phase 4: Application Logic (NOT STARTED)
- [ ] Update manager override endpoint to use `overrideStatus`
- [ ] Update job completion endpoint to check `is_voided` when counting photos
- [ ] Update invoice calculation to exclude voided line items
- [ ] Add endpoint to query void audit trails

### Phase 5: Testing (NOT STARTED)
- [ ] Test media soft-void
- [ ] Test invoice line item soft-void
- [ ] Test override reason enforcement
- [ ] Test override status enforcement
- [ ] Test unique open invoice constraint

---

## 7. Migration Path

### Step 1: Apply Schema Changes
```bash
pnpm db:push
```

### Step 2: Apply Constraints & Procedures
```bash
# Run SQL migration file
mysql -u user -p database < drizzle/migrations/append-only-enforcement.sql
```

### Step 3: Update Application Logic
- Update manager override endpoints
- Update invoice calculation
- Add void audit query endpoints

### Step 4: Test
- Test soft-void operations
- Test constraint enforcement
- Test override semantics

---

## 8. Backward Compatibility

**No breaking changes:**
- `is_voided` defaults to `FALSE`, so existing records are unaffected
- `override_status` is optional for existing overrides
- Soft-void is additive (no deletion of existing data)
- Queries must be updated to filter `is_voided = FALSE` for active records

---

## 9. Audit Trail Examples

### Query: All photos for a job (active only)
```sql
SELECT * FROM media 
WHERE job_id = 'job_123' AND is_voided = FALSE
ORDER BY uploaded_at DESC;
```

### Query: Photo void history
```sql
SELECT * FROM media_void_audit 
WHERE job_id = 'job_123'
ORDER BY voided_at DESC;
```

### Query: Invoice line item void history
```sql
SELECT * FROM invoice_line_item_void_audit 
WHERE invoice_id = 'inv_123'
ORDER BY voided_at DESC;
```

### Query: Manager overrides for a job
```sql
SELECT id, status, overridden_by, override_reason, override_status, overridden_at
FROM cleaning_jobs
WHERE id = 'job_123' AND overridden_by IS NOT NULL;
```

---

## 10. Summary

**Append-Only Enforcement:**
- ✅ Database-level constraints prevent UPDATE/DELETE
- ✅ Soft-void mechanism allows corrections with audit trail
- ✅ Immutable records preserved for compliance

**Manager Override Semantics:**
- ✅ Explicit override status ("completed" vs "needs_review")
- ✅ Required override reason for audit trail
- ✅ Timestamp tracking for accountability

**Benefits:**
- Complete audit trail of all changes
- Prevents accidental data loss
- Compliance-ready for regulatory requirements
- Clear manager override semantics

---

**Status:** Design Complete, Ready for Implementation  
**Next Step:** Apply database migration and update application logic
