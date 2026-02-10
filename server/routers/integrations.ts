/**
 * Integrations Router — API Framework (Skeleton Only)
 *
 * This router provides the structural framework for external API integrations.
 * All endpoints are DISABLED by default pending governance approval.
 *
 * CONSTRAINTS:
 * - Endpoints may be defined but must remain disabled
 * - No third-party credentials stored
 * - No live PMS connections (including Guesty)
 * - Clear labeling: "Integrations present but inactive pending governance approval"
 * - Global OFF switch must be enforced
 * - No write operations
 * - No data sync
 * - No modifications to internal records
 *
 * File: server/routers/integrations.ts
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, managerProcedure, router } from "../_core/trpc";

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationStatus {
  name: string;
  platform: string;
  status: "disabled" | "enabled" | "pending_approval";
  lastSyncAttempt: Date | null;
  errorMessage: string | null;
  description: string;
}

export interface IntegrationConfig {
  integrationId: string;
  platform: string;
  isEnabled: boolean;
  requiresApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
}

// ============================================================================
// GLOBAL INTEGRATION STATE
// ============================================================================

// Global OFF switch — all integrations disabled until explicitly approved
const INTEGRATIONS_ENABLED = process.env.INTEGRATIONS_ENABLED === "true" ? true : false;

// ============================================================================
// ROUTER
// ============================================================================

export const integrationsRouter = router({
  /**
   * Get integration status (read-only, observational)
   * Shows all available integrations and their current status.
   *
   * Permission: manager and above
   * Returns: List of integration statuses (disabled by default)
   */
  getStatus: managerProcedure.query(async (opts) => {
    // Global OFF switch check
    if (!INTEGRATIONS_ENABLED) {
      return {
        globalStatus: "disabled" as const,
        message: "Integrations present but inactive pending governance approval",
        integrations: [
          {
            name: "Guesty",
            platform: "guesty",
            status: "disabled" as const,
            lastSyncAttempt: null,
            errorMessage: "Integration framework disabled",
            description: "Property management system integration (read-only, dormant)",
          },
          {
            name: "Hostaway",
            platform: "hostaway",
            status: "disabled" as const,
            lastSyncAttempt: null,
            errorMessage: "Integration framework disabled",
            description: "Property management system integration (planned, dormant)",
          },
        ] as IntegrationStatus[],
      };
    }

    // If integrations are enabled, return status
    // (This path is not reachable unless INTEGRATIONS_ENABLED is true)
    return {
      globalStatus: "enabled" as const,
      message: "Integrations framework active",
      integrations: [] as IntegrationStatus[],
    };
  }),

  /**
   * Get integration configuration (read-only)
   * Shows configuration for a specific integration.
   *
   * Permission: manager and above
   * Returns: Integration configuration (disabled by default)
   */
  getConfig: managerProcedure
    .input(z.object({ integrationId: z.string() }))
    .query(async (opts) => {
      // Global OFF switch check
      if (!INTEGRATIONS_ENABLED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Integrations are disabled pending governance approval",
        });
      }

      // This endpoint is unreachable unless integrations are enabled
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Integration not found",
      });
    }),

  /**
   * Inbound job creation interface (DISABLED)
   * This endpoint would accept job data from external PMS systems.
   * Currently disabled and returns error.
   *
   * Permission: Requires API key authentication (not implemented)
   * Returns: Error (disabled)
   */
  createJobFromExternalPMS: protectedProcedure
    .input(
      z.object({
        externalBookingId: z.string(),
        propertyId: z.string(),
        checkInDate: z.date(),
        checkOutDate: z.date(),
        platform: z.enum(["guesty", "hostaway", "other"]),
      })
    )
    .mutation(async (opts) => {
      // Global OFF switch check
      if (!INTEGRATIONS_ENABLED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Job creation from external PMS is disabled pending governance approval",
        });
      }

      // This endpoint is unreachable unless integrations are enabled
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "External job creation not yet implemented",
      });
    }),

  /**
   * Outbound export endpoint (DISABLED)
   * This endpoint would export job/invoice data to external systems.
   * Currently disabled and returns error.
   *
   * Permission: Requires API key authentication (not implemented)
   * Returns: Error (disabled)
   */
  exportDataToExternalSystem: protectedProcedure
    .input(
      z.object({
        dataType: z.enum(["jobs", "invoices", "cleaners"]),
        format: z.enum(["json", "csv"]),
        integrationId: z.string(),
      })
    )
    .mutation(async (opts) => {
      // Global OFF switch check
      if (!INTEGRATIONS_ENABLED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Data export to external systems is disabled pending governance approval",
        });
      }

      // This endpoint is unreachable unless integrations are enabled
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "External data export not yet implemented",
      });
    }),

  /**
   * Get global integration status (read-only)
   * Shows whether integrations framework is enabled or disabled.
   *
   * Permission: manager and above
   * Returns: Global status and governance message
   */
  getGlobalStatus: managerProcedure.query(async (opts) => {
    return {
      isEnabled: INTEGRATIONS_ENABLED,
      message: INTEGRATIONS_ENABLED
        ? "Integrations framework is active"
        : "Integrations present but inactive pending governance approval",
      governanceGate: "Integrations disabled until approved",
      environment: process.env.NODE_ENV || "production",
    };
  }),
});

export type IntegrationsRouter = typeof integrationsRouter;
