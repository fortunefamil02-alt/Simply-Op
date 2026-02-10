-- ============================================================================
-- MIGRATION: 0003_add_sandbox_isolation
-- ============================================================================
-- Purpose: Add sandbox isolation flag to businesses table
-- Date: 2026-02-10
-- Status: Manual migration (forward-only, reversible)
-- 
-- This migration adds:
-- 1. isSandbox BOOLEAN column to businesses table
-- 2. Default value: false (production mode)
-- 3. Sandbox businesses are explicitly created, never converted
-- 4. Sandbox data must never be queried alongside production data
--
-- FORWARD: Add column
-- REVERSE: Drop column

-- ============================================================================
-- ADD COLUMN: isSandbox to businesses table
-- ============================================================================

ALTER TABLE businesses 
ADD COLUMN is_sandbox BOOLEAN NOT NULL DEFAULT false 
COMMENT 'Sandbox isolation flag (default: production)';

-- ============================================================================
-- INDEX: Optimize sandbox queries
-- ============================================================================

CREATE INDEX businesses_is_sandbox_idx ON businesses(is_sandbox);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Sandbox Constraints:
-- - Sandbox businesses are explicitly created, never converted
-- - Sandbox data must never be queried alongside production data
-- - No outbound calls, integrations, or credentials permitted in sandbox
-- - Sandbox is for manual fake input and demo purposes only
-- - Persistent visual banner indicating SANDBOX
-- - Read-only or fake-write paths only
-- - No linkage to real users, payments, jobs, or third-party systems
--
-- Implementation:
-- - All queries must include: WHERE is_sandbox = false (for production)
-- - All queries must include: WHERE is_sandbox = true (for sandbox)
-- - Never mix: WHERE is_sandbox IN (true, false)
-- - Sandbox accounts must be isolated at query level
--
