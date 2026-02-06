-- ============================================================================
-- MIGRATION: 0002_append_only_constraints
-- ============================================================================
-- Purpose: Add database-level append-only enforcement for media and invoice_line_items
-- Date: 2026-02-06
-- Status: Manual migration (do not auto-apply)
-- 
-- This migration adds:
-- 1. Triggers to prevent UPDATE/DELETE on media
-- 2. Triggers to prevent UPDATE/DELETE on invoice_line_items
-- 3. Triggers to enforce invoice immutability
-- 4. Trigger to enforce manager override semantics
-- 5. Unique constraint for one open invoice per cleaner
--
-- NOTE: This assumes the following columns already exist:
-- - media.is_voided (added in schema update)
-- - invoice_line_items.is_voided, void_reason, voided_at (added in schema update)
-- - cleaning_jobs.override_status (added in schema update)
--
-- If columns don't exist, add them first:
-- ALTER TABLE media ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE invoice_line_items ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE invoice_line_items ADD COLUMN void_reason TEXT;
-- ALTER TABLE invoice_line_items ADD COLUMN voided_at TIMESTAMP;
-- ALTER TABLE cleaning_jobs ADD COLUMN override_status VARCHAR(50);

-- ============================================================================
-- SECTION 1: MEDIA TABLE TRIGGERS
-- ============================================================================

-- Trigger: Prevent UPDATE on media (except is_voided for soft-void)
DROP TRIGGER IF EXISTS media_prevent_update;
DELIMITER //
CREATE TRIGGER media_prevent_update BEFORE UPDATE ON media
FOR EACH ROW
BEGIN
  -- Allow soft-void (is_voided can be set to TRUE)
  IF OLD.is_voided = FALSE AND NEW.is_voided = TRUE THEN
    -- Allow soft-void transition
    SET NEW.is_voided = NEW.is_voided;
  ELSEIF OLD.is_voided = NEW.is_voided THEN
    -- Reject any UPDATE if is_voided didn't change
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Media records are immutable. Use soft-void (is_voided=true) instead.';
  ELSE
    -- Reject any other UPDATE
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Media records are immutable. Use soft-void (is_voided=true) instead.';
  END IF;
END //
DELIMITER ;

-- Trigger: Prevent DELETE on media
DROP TRIGGER IF EXISTS media_prevent_delete;
DELIMITER //
CREATE TRIGGER media_prevent_delete BEFORE DELETE ON media
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' 
  SET MESSAGE_TEXT = 'Media records cannot be deleted. Use soft-void (is_voided=true) instead.';
END //
DELIMITER ;

-- ============================================================================
-- SECTION 2: INVOICE_LINE_ITEMS TABLE TRIGGERS
-- ============================================================================

-- Trigger: Prevent UPDATE on invoice_line_items (any field)
DROP TRIGGER IF EXISTS invoice_line_items_prevent_update;
DELIMITER //
CREATE TRIGGER invoice_line_items_prevent_update BEFORE UPDATE ON invoice_line_items
FOR EACH ROW
BEGIN
  -- Allow soft-void (is_voided can be set to TRUE with reason and timestamp)
  IF OLD.is_voided = FALSE AND NEW.is_voided = TRUE THEN
    -- Allow soft-void transition (is_voided, void_reason, voided_at can be set)
    SET NEW.is_voided = NEW.is_voided;
  ELSEIF OLD.is_voided = NEW.is_voided THEN
    -- Reject any UPDATE if is_voided didn't change
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Invoice line items are immutable. Use soft-void (is_voided=true) instead.';
  ELSE
    -- Reject any other UPDATE
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Invoice line items are immutable. Use soft-void (is_voided=true) instead.';
  END IF;
END //
DELIMITER ;

-- Trigger: Prevent DELETE on invoice_line_items
DROP TRIGGER IF EXISTS invoice_line_items_prevent_delete;
DELIMITER //
CREATE TRIGGER invoice_line_items_prevent_delete BEFORE DELETE ON invoice_line_items
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' 
  SET MESSAGE_TEXT = 'Invoice line items cannot be deleted. Use soft-void (is_voided=true) instead.';
END //
DELIMITER ;

-- ============================================================================
-- SECTION 3: INVOICES TABLE TRIGGERS
-- ============================================================================

-- Trigger: Prevent totalAmount UPDATE on submitted invoices
DROP TRIGGER IF EXISTS invoices_prevent_amount_update;
DELIMITER //
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
END //
DELIMITER ;

-- ============================================================================
-- SECTION 4: CLEANING_JOBS TABLE TRIGGERS
-- ============================================================================

-- Trigger: Enforce manager override semantics (reason + status required)
DROP TRIGGER IF EXISTS override_reason_required;
DELIMITER //
CREATE TRIGGER override_reason_required BEFORE UPDATE ON cleaning_jobs
FOR EACH ROW
BEGIN
  -- If overriddenBy is being set, enforce required fields
  IF NEW.overridden_by IS NOT NULL AND OLD.overridden_by IS NULL THEN
    -- This is a new override
    
    -- Enforce: overrideReason must not be empty
    IF NEW.override_reason IS NULL OR NEW.override_reason = '' THEN
      SIGNAL SQLSTATE '45000' 
      SET MESSAGE_TEXT = 'Override reason is required when overriding a job.';
    END IF;
    
    -- Enforce: overriddenAt must be set
    IF NEW.overridden_at IS NULL THEN
      SIGNAL SQLSTATE '45000' 
      SET MESSAGE_TEXT = 'Override timestamp is required when overriding a job.';
    END IF;
    
    -- Enforce: overrideStatus must be explicit ("completed" or "needs_review")
    IF NEW.override_status IS NULL OR NEW.override_status NOT IN ('completed', 'needs_review') THEN
      SIGNAL SQLSTATE '45000' 
      SET MESSAGE_TEXT = 'Override status must be explicit: "completed" or "needs_review".';
    END IF;
  END IF;
END //
DELIMITER ;

-- ============================================================================
-- SECTION 5: UNIQUE CONSTRAINTS
-- ============================================================================

-- Unique constraint: One open invoice per cleaner
-- This allows multiple submitted/approved/paid invoices, but only one open per cleaner
ALTER TABLE invoices ADD UNIQUE KEY unique_open_invoice_per_cleaner (
  cleaner_id,
  CASE WHEN status = 'open' THEN 1 ELSE NULL END
);

-- ============================================================================
-- SECTION 6: VERIFICATION QUERIES
-- ============================================================================
-- Use these queries to verify the constraints are working

-- 1. Verify media trigger is active
-- SELECT TRIGGER_NAME, TRIGGER_SCHEMA, ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS 
-- WHERE TRIGGER_NAME LIKE 'media%' AND TRIGGER_SCHEMA = DATABASE();

-- 2. Verify invoice_line_items trigger is active
-- SELECT TRIGGER_NAME, TRIGGER_SCHEMA, ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS 
-- WHERE TRIGGER_NAME LIKE 'invoice_line_items%' AND TRIGGER_SCHEMA = DATABASE();

-- 3. Verify invoices trigger is active
-- SELECT TRIGGER_NAME, TRIGGER_SCHEMA, ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS 
-- WHERE TRIGGER_NAME LIKE 'invoices%' AND TRIGGER_SCHEMA = DATABASE();

-- 4. Verify cleaning_jobs trigger is active
-- SELECT TRIGGER_NAME, TRIGGER_SCHEMA, ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS 
-- WHERE TRIGGER_NAME LIKE 'override%' AND TRIGGER_SCHEMA = DATABASE();

-- 5. Verify unique constraint on invoices
-- SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
-- WHERE CONSTRAINT_NAME = 'unique_open_invoice_per_cleaner' AND TABLE_SCHEMA = DATABASE();

-- ============================================================================
-- SECTION 7: ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If you need to rollback this migration, run:
--
-- DROP TRIGGER IF EXISTS media_prevent_update;
-- DROP TRIGGER IF EXISTS media_prevent_delete;
-- DROP TRIGGER IF EXISTS invoice_line_items_prevent_update;
-- DROP TRIGGER IF EXISTS invoice_line_items_prevent_delete;
-- DROP TRIGGER IF EXISTS invoices_prevent_amount_update;
-- DROP TRIGGER IF EXISTS override_reason_required;
-- ALTER TABLE invoices DROP KEY unique_open_invoice_per_cleaner;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
