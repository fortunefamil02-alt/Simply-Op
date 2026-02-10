import { router, managerProcedure, protectedProcedure } from "@/server/_core/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/server/db";
import { jobs } from "@/server/db/schema";

/**
 * Jobs Detail Router - Get individual job details
 */
export const jobsDetailRouter = router({
  /**
   * Get job by ID for manager
   */
  getByIdForManager: managerProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { jobId } = input;
      const job = await db.query.jobs.findFirst({
        where: and(eq(jobs.id, jobId), eq(jobs.companyId, ctx.user.companyId)),
        with: {
          property: true,
          assignedCleaner: true,
        },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      return job;
    }),

  /**
   * Get job by ID for cleaner
   */
  getByIdForCleaner: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { jobId } = input;
      const job = await db.query.jobs.findFirst({
        where: and(eq(jobs.id, jobId), eq(jobs.companyId, ctx.user.companyId)),
        with: {
          property: true,
          assignedCleaner: true,
        },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      return job;
    }),
});
