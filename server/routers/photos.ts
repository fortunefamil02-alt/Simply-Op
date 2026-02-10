import { router, protectedProcedure } from "@/server/_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { photos, jobs } from "@/server/db/schema";
import { randomUUID } from "crypto";

/**
 * Photos Router - Upload and fetch job photos
 */
export const photosRouter = router({
  /**
   * Upload photo for a job
   * Expects base64 image data, stores in S3, returns URL
   */
  uploadPhoto: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        imageBase64: z.string(), // Base64 encoded image
        room: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { jobId, imageBase64, room } = input;

      // Verify job exists and belongs to user's company
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (!job) {
        throw new Error("Job not found");
      }

      if (job.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      // TODO: Upload to S3 and get URL
      // For now, use placeholder URL
      const photoUrl = `https://photos.example.com/${randomUUID()}.jpg`;

      // Store photo record
      const photoId = randomUUID();
      await db.insert(photos).values({
        id: photoId,
        jobId,
        uri: photoUrl,
        room: room || null,
        uploadedAt: new Date(),
        createdAt: new Date(),
      });

      return {
        id: photoId,
        uri: photoUrl,
        room,
      };
    }),

  /**
   * Get all photos for a job
   */
  getJobPhotos: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { jobId } = input;

      // Verify job exists and user has access
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (!job) {
        throw new Error("Job not found");
      }

      if (job.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      // Fetch photos
      const jobPhotos = await db.query.photos.findMany({
        where: eq(photos.jobId, jobId),
      });

      return jobPhotos;
    }),

  /**
   * Delete photo (cleaner can delete before job completion)
   */
  deletePhoto: protectedProcedure
    .input(z.object({ photoId: z.string(), jobId: z.string() }))
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { photoId, jobId } = input;

      // Verify job exists and user has access
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (!job) {
        throw new Error("Job not found");
      }

      if (job.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      // Only allow deletion if job is not completed
      if (job.status === "completed") {
        throw new Error("Cannot delete photos from completed job");
      }

      // Delete photo
      await db.delete(photos).where(eq(photos.id, photoId));

      return { success: true };
    }),
});
