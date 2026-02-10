import { router, publicProcedure } from "@/server/_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses } from "@/server/db/schema";

/**
 * Business router - public endpoints for business status checks
 */
export const businessRouter = router({
  /**
   * Get business status by businessId
   * Used by app on launch to determine if business is active/pending/suspended
   * Public endpoint - no auth required (status is not sensitive)
   */
  getStatus: publicProcedure
    .input(
      z.object({
        businessId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = (await getDb()) as any;
      if (!db) {
        throw new Error("Database connection failed");
      }

      const { businessId } = input;

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business) {
        return {
          status: null,
          reason: null,
        };
      }

      return {
        status: business.status,
        reason: business.suspensionReason || null,
      };
    }),
});
