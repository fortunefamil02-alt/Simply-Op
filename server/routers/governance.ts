import { router, publicProcedure } from "@/server/_core/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, auditLog, users } from "@/server/db/schema";

/**
 * Founder-only governance router
 * Controls business activation, suspension, and audit logging
 * All actions are immutable and logged
 */

/**
 * Founder procedure - only allows users with founder role
 */
const founderProcedure = publicProcedure.use(async (opts) => {
  const user = opts.ctx.user;

  if (!user || (user.role as string) !== "founder") {
    throw new Error("Founder access required");
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      founder: user,
    },
  });
});

/**
 * Log a governance action to the immutable audit log
 */
async function logGovernanceAction(
  db: any,
  founderId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, any>
) {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(auditLog).values({
    id: auditId,
    founderId,
    action,
    targetType,
    targetId,
    details,
    createdAt: new Date(),
  });

  return auditId;
}

export const governanceRouter = router({
  /**
   * Get all businesses (founder view)
   * Shows pending, active, and suspended businesses
   */
  getBusinesses: founderProcedure.query(async ({ ctx }) => {
    const db = (await getDb()) as any;
    if (!db) {
      throw new Error("Database connection failed");
    }

    const allBusinesses = await db.query.businesses.findMany({
      where: eq(businesses.founderId, ctx.founder.id),
      orderBy: (table: any) => table.createdAt,
    });

    return allBusinesses.map((b: any) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt,
      activatedAt: b.activatedAt,
      suspendedAt: b.suspendedAt,
      suspensionReason: b.suspensionReason,
    }));
  }),

  /**
   * Activate a pending business
   * Transition: pending → active
   * Only founder can activate
   * Action is logged immutably
   */
  activateBusiness: founderProcedure
    .input(
      z.object({
        businessId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb()) as any;
      if (!db) {
        throw new Error("Database connection failed");
      }

      const { businessId } = input;

      // Verify business exists and belongs to this founder
      const business = await db.query.businesses.findFirst({
        where: and(
          eq(businesses.id, businessId),
          eq(businesses.founderId, ctx.founder.id)
        ),
      });

      if (!business) {
        throw new Error("Business not found");
      }

      if (business.status !== "pending") {
        throw new Error(`Cannot activate business with status: ${business.status}`);
      }

      // Update business status to active
      await db
        .update(businesses)
        .set({
          status: "active",
          activatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

      // Log action immutably
      await logGovernanceAction(
        db,
        ctx.founder.id,
        "business_activated",
        "business",
        businessId,
        {
          businessName: business.name,
          previousStatus: "pending",
          newStatus: "active",
          activatedBy: ctx.founder.email,
        }
      );

      return {
        success: true,
        businessId,
        newStatus: "active",
      };
    }),

  /**
   * Suspend an active business
   * Transition: active → suspended
   * Only founder can suspend
   * Requires suspension reason
   * Action is logged immutably
   */
  suspendBusiness: founderProcedure
    .input(
      z.object({
        businessId: z.string(),
        reason: z.string().min(10, "Suspension reason must be at least 10 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb()) as any;
      if (!db) {
        throw new Error("Database connection failed");
      }

      const { businessId, reason } = input;

      // Verify business exists and belongs to this founder
      const business = await db.query.businesses.findFirst({
        where: and(
          eq(businesses.id, businessId),
          eq(businesses.founderId, ctx.founder.id)
        ),
      });

      if (!business) {
        throw new Error("Business not found");
      }

      if (business.status === "suspended") {
        throw new Error("Business is already suspended");
      }

      // Update business status to suspended
      await db
        .update(businesses)
        .set({
          status: "suspended",
          suspendedAt: new Date(),
          suspensionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

      // Log action immutably
      await logGovernanceAction(
        db,
        ctx.founder.id,
        "business_suspended",
        "business",
        businessId,
        {
          businessName: business.name,
          previousStatus: business.status,
          newStatus: "suspended",
          suspensionReason: reason,
          suspendedBy: ctx.founder.email,
        }
      );

      return {
        success: true,
        businessId,
        newStatus: "suspended",
      };
    }),

  /**
   * Get immutable audit log for a business
   * Shows all governance actions taken on this business
   * Founder-only access
   */
  getBusinessAuditLog: founderProcedure
    .input(
      z.object({
        businessId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = (await getDb()) as any;
      if (!db) {
        throw new Error("Database connection failed");
      }

      const { businessId } = input;

      // Verify business belongs to this founder
      const business = await db.query.businesses.findFirst({
        where: and(
          eq(businesses.id, businessId),
          eq(businesses.founderId, ctx.founder.id)
        ),
      });

      if (!business) {
        throw new Error("Business not found");
      }

      // Get all audit log entries for this business
      const logs = await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, businessId),
          eq(auditLog.founderId, ctx.founder.id)
        ),
        orderBy: (table: any) => table.createdAt,
      });

      return logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
      }));
    }),

  /**
   * Get all audit logs (founder view)
   * Shows all governance actions across all businesses
   * Immutable record of all founder actions
   */
  getAllAuditLogs: founderProcedure.query(async ({ ctx }) => {
    const db = (await getDb()) as any;
    if (!db) {
      throw new Error("Database connection failed");
    }

    const logs = await db.query.auditLog.findMany({
      where: eq(auditLog.founderId, ctx.founder.id),
      orderBy: (table: any) => table.createdAt,
    });

    return logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      createdAt: log.createdAt,
    }));
  }),
});
