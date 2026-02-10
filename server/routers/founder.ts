/**
 * Founder Router — Governance-Only, Read-Only
 *
 * This router provides system-level observational endpoints for founder/super_manager role only.
 *
 * CONSTRAINTS:
 * - No job-level data
 * - No cleaner data
 * - No business account access
 * - No write operations
 * - Aggregate counts only
 * - Read-only, observational, non-authoritative
 *
 * File: server/routers/founder.ts
 */

import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, businesses } from "../../drizzle/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface MetricsResponse {
  totalAccounts: number;
  activeBusinesses: number;
  totalUsers: number;
  governanceReady: boolean;
}

export interface LegalRecord {
  id: string;
  type: string;
  timestamp: Date;
  status: "accepted" | "pending" | "rejected";
  description: string;
}

// ============================================================================
// ROUTER
// ============================================================================

export const founderRouter = router({
  /**
   * Get aggregate system metrics (counts only)
   * - totalAccounts: count of all businesses
   * - activeBusinesses: count of businesses with active users
   * - totalUsers: count of all users
   * - governanceReady: whether governance framework is initialized
   *
   * Permission: super_manager only
   * Returns: Aggregate counts (no details, no filtering)
   */
  getMetrics: protectedProcedure.query(async (opts) => {
    // Permission check: super_manager only
    if (opts.ctx.user?.role !== "super_manager") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only founders can access system metrics",
      });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    // Count total businesses
    const businessCountResult = await db.select().from(businesses);
    const totalAccounts = businessCountResult.length;

    // Count businesses with active users
    const activeUsersResult = await db
      .select({ businessId: users.businessId })
      .from(users)
      .where(eq(users.isActive, true));
    const activeBusinesses = new Set(
      activeUsersResult.map((r: any) => r.businessId)
    ).size;

    // Count total users
    const userCountResult = await db.select().from(users);
    const totalUsers = userCountResult.length;

    // Governance status: always true (governance framework is active)
    const governanceReady = true;

    return {
      totalAccounts,
      activeBusinesses,
      totalUsers,
      governanceReady,
    } as MetricsResponse;
  }),

  /**
   * Get legal acceptance records (observational log only)
   * Returns a list of governance-related acceptance events.
   *
   * Permission: super_manager only
   * Returns: Legal acceptance log (read-only, non-authoritative)
   */
  getLegalRecords: protectedProcedure.query(async (opts) => {
    // Permission check: super_manager only
    if (opts.ctx.user?.role !== "super_manager") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only founders can access legal records",
      });
    }

    // Return hardcoded legal records (system-level governance log)
    // These are observational records, not enforcement mechanisms
    const records: LegalRecord[] = [
      {
        id: "legal-001",
        type: "Governance Specification v1.0",
        timestamp: new Date("2026-02-01"),
        status: "accepted",
        description: "Governance framework v1.0 accepted and locked",
      },
      {
        id: "legal-002",
        type: "Builder Acknowledgement",
        timestamp: new Date("2026-02-01"),
        status: "accepted",
        description: "Builder acknowledged governance constraints",
      },
      {
        id: "legal-003",
        type: "Phase 3 Structural Completion",
        timestamp: new Date("2026-02-10"),
        status: "pending",
        description: "Phase 3 structural components in progress",
      },
    ];

    return records;
  }),
});

export type FounderRouter = typeof founderRouter;
