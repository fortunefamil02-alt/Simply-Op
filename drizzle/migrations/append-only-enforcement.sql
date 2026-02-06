-- ============================================================================
-- APPEND-ONLY ENFORCEMENT: Media Table
-- ============================================================================
-- Prevent UPDATE/DELETE on media records
-- Allow soft-void via isVoided flag for corrections

-- 1. Add isVoided flag to media table (for soft-void)
ALTER TABLE media ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT FALSE AFTER created_at;

-- 2. Add trigger to prevent UPDATE on media (except is_voided)
CREATE TRIGGER media_prevent_update BEFORE UPDATE ON media
FOR EACH ROW
BEGIN
  -- Allow only is_voided to be updated (for soft-void)
  IF OLD.is_voided <> NEW.is_voided THEN
    -- Allow soft-void
    SET NEW.is_voided = NEW.is_voided;
  ELSE
    -- Reject any other UPDATE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Media records are immutable. Use soft-void (is_voided=true) instead.';
  END IF;
END;

-- 3. Add trigger to prevent DELETE on media
CREATE TRIGGER media_prevent_delete BEFORE DELETE ON media
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Media records cannot be deleted. Use soft-void (is_voided=true) instead.';
END;

-- ============================================================================
-- APPEND-ONLY ENFORCEMENT: Invoice Line Items Table
-- ============================================================================
-- Prevent UPDATE/DELETE on invoice line items
-- Allow soft-void via isVoided flag for corrections

-- 1. Add isVoided flag to invoice_line_items table (for soft-void)
ALTER TABLE invoice_line_items ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT FALSE AFTER created_at;

-- 2. Add voidReason for audit trail
ALTER TABLE invoice_line_items ADD COLUMN void_reason TEXT AFTER is_voided;

-- 3. Add voidedAt timestamp
ALTER TABLE invoice_line_items ADD COLUMN voided_at TIMESTAMP AFTER void_reason;

-- 4. Add trigger to prevent UPDATE on invoice_line_items (except is_voided)
CREATE TRIGGER invoice_line_items_prevent_update BEFORE UPDATE ON invoice_line_items
FOR EACH ROW
BEGIN
  -- Reject any UPDATE (use soft-void instead)
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice line items are immutable. Use soft-void (is_voided=true) instead.';
END;

-- 5. Add trigger to prevent DELETE on invoice_line_items
CREATE TRIGGER invoice_line_items_prevent_delete BEFORE DELETE ON invoice_line_items
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice line items cannot be deleted. Use soft-void (is_voided=true) instead.';
END;

-- ============================================================================
-- APPEND-ONLY ENFORCEMENT: Invoice Table
-- ============================================================================
-- Prevent UPDATE to submitted invoices (except status/payment fields)

-- 1. Add trigger to prevent totalAmount UPDATE on submitted invoices
CREATE TRIGGER invoices_prevent_amount_update BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
  -- If invoice is submitted, prevent totalAmount changes
  IF OLD.status = 'submitted' AND OLD.total_amount <> NEW.total_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot modify invoice amount after submission.';
  END IF;
  
  -- If invoice is submitted, prevent status rollback
  IF OLD.status = 'submitted' AND NEW.status IN ('open', 'draft') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot revert submitted invoice to open/draft status.';
  END IF;
END;

-- ============================================================================
-- SOFT-VOID MECHANISM
-- ============================================================================
-- Allows corrections without deleting records (audit trail preserved)

-- 1. Create audit table for voided media
CREATE TABLE IF NOT EXISTS media_void_audit (
  id VARCHAR(64) PRIMARY KEY,
  media_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  void_reason TEXT NOT NULL,
  voided_by VARCHAR(64) NOT NULL,  -- User ID who voided
  voided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (media_id) REFERENCES media(id),
  INDEX media_id_idx (media_id),
  INDEX job_id_idx (job_id),
  INDEX voided_by_idx (voided_by)
);

-- 2. Create audit table for voided invoice line items
CREATE TABLE IF NOT EXISTS invoice_line_item_void_audit (
  id VARCHAR(64) PRIMARY KEY,
  line_item_id VARCHAR(64) NOT NULL,
  invoice_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  void_reason TEXT NOT NULL,
  voided_by VARCHAR(64) NOT NULL,  -- User ID who voided
  voided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_item_id) REFERENCES invoice_line_items(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  INDEX line_item_id_idx (line_item_id),
  INDEX invoice_id_idx (invoice_id),
  INDEX job_id_idx (job_id),
  INDEX voided_by_idx (voided_by)
);

-- ============================================================================
-- MANAGER OVERRIDE SEMANTICS
-- ============================================================================
-- Clarify override behavior and enforce audit trail

-- 1. Update cleaning_jobs table to clarify override semantics
-- overriddenBy: Manager ID who performed override
-- overrideReason: Required reason for override
-- overriddenAt: Timestamp of override
-- overrideStatus: Explicit status after override (completed vs needs_review)

ALTER TABLE cleaning_jobs ADD COLUMN override_status VARCHAR(50) AFTER overridden_at;
-- Values: "completed" (force completion) or "needs_review" (flag for review)

-- 2. Add trigger to enforce override reason is not empty
CREATE TRIGGER override_reason_required BEFORE UPDATE ON cleaning_jobs
FOR EACH ROW
BEGIN
  -- If overriddenBy is set, overrideReason must not be empty
  IF NEW.overridden_by IS NOT NULL AND (NEW.override_reason IS NULL OR NEW.override_reason = '') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Override reason is required when overriding a job.';
  END IF;
  
  -- If overriddenBy is set, overriddenAt must be set
  IF NEW.overridden_by IS NOT NULL AND NEW.overridden_at IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Override timestamp is required when overriding a job.';
  END IF;
  
  -- If overriddenBy is set, overrideStatus must be explicit
  IF NEW.overridden_by IS NOT NULL AND (NEW.override_status IS NULL OR NEW.override_status NOT IN ('completed', 'needs_review')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Override status must be explicit: "completed" or "needs_review".';
  END IF;
END;

-- ============================================================================
-- INVOICE IMMUTABILITY
-- ============================================================================
-- Enforce one open invoice per cleaner per cycle

-- 1. Add unique constraint to prevent duplicate open invoices
ALTER TABLE invoices ADD UNIQUE KEY unique_open_invoice_per_cleaner (
  cleaner_id,
  CASE WHEN status = 'open' THEN 1 ELSE NULL END
);
-- This allows multiple submitted/approved/paid invoices, but only one open per cleaner

-- ============================================================================
-- SOFT-VOID PROCEDURES
-- ============================================================================
-- Stored procedures to safely void media and invoice line items

-- 1. Procedure to void media record
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

-- 2. Procedure to void invoice line item
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

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Use these to verify append-only enforcement

-- 1. Check all media records (including voided)
-- SELECT id, job_id, type, is_voided, created_at FROM media;

-- 2. Check all invoice line items (including voided)
-- SELECT id, invoice_id, job_id, is_voided, void_reason, voided_at FROM invoice_line_items;

-- 3. Check media void audit trail
-- SELECT * FROM media_void_audit;

-- 4. Check invoice line item void audit trail
-- SELECT * FROM invoice_line_item_void_audit;

-- 5. Verify unique open invoice per cleaner
-- SELECT cleaner_id, COUNT(*) as open_count FROM invoices WHERE status = 'open' GROUP BY cleaner_id HAVING COUNT(*) > 1;
