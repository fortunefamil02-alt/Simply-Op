/**
 * Manager Override Router
 * 
 * Allows managers to override job completion when conflicts exist:
 * - GPS validation failed (cleaner too far from property)
 * - Missing photos (cleaner didn't upload required photos)
 * - Other conflicts (access denied, etc.)
 * 
 * All overrides are logged for audit trail.
 * No notifications sent (minimal scope).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { cleaningJobs, media, properties } from "../../drizzle/schema";
import { managerProcedure } from "../_core/trpc";

// ============================================================================
// TYPES
// ============================================================================

type ConflictType = "gps_mismatch" | "missing_photos" | "access_denied" | "other";

interface JobConflict {
  type: ConflictType;
  message: string;
  distance?: number; // GPS distance in meters
  photoCount?: number; // Number of photos uploaded
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Detect conflicts that would prevent job completion
 */
async function detectJobConflicts(
  tx: any,
  jobId: string,
  gpsLat: number,
  gpsLng: number
): Promise<JobConflict[]> {
  const conflicts: JobConflict[] = [];

  // Get job and property
  const job = await tx.query.cleaningJobs.findFirst({
    where: eq(cleaningJobs.id, jobId),
  });

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Job not found",
    });
  }

  const property = await tx.query.properties.findFirst({
    where: eq(properties.id, job.propertyId),
    columns: { latitude: true, longitude: true },
  });

  // Check GPS conflict
  if (property?.latitude && property?.longitude) {
    const distance = calculateDistance(
      property.latitude,
      property.longitude,
      gpsLat,
      gpsLng
    );

    if (distance > 50) {
      conflicts.push({
        type: "gps_mismatch",
        message: `GPS location is ${Math.round(distance)}m from property (max 50m allowed)`,
        distance,
      });
    }
  }

  // Check photo conflict
  const photos = await tx.query.media.findMany({
    where: and(eq(media.jobId, jobId), eq(media.type, "photo")),
  });

  if (photos.length === 0) {
    conflicts.push({
      type: "missing_photos",
      message: "No photos uploaded for this job",
      photoCount: 0,
    });
  }

  // Check access denied
  if (job.accessDenied) {
    conflicts.push({
      type: "access_denied",
      message: "Job marked as access denied (guest present)",
    });
  }

  return conflicts;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// ROUTER
// ============================================================================

export const managerOverridesRouter = {
  /**
   * Detect conflicts for a job (dry-run, doesn't change anything)
   */
  detectConflicts: managerProcedure
    .input(
      z.object({
        jobId: z.string(),
        gpsLat: z.number(),
        gpsLng: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const conflicts = await db.transaction(async (tx: any) => {
        return detectJobConflicts(tx, input.jobId, input.gpsLat, input.gpsLng);
      });

      return {
        jobId: input.jobId,
        hasConflicts: conflicts.length > 0,
        conflicts,
      };
    }),

  /**
   * Override job completion (force job to completed status)
   * 
   * Used when:
   * - GPS validation failed but manager trusts cleaner
   * - Photos missing but manager verified work was done
   * - Access denied but manager wants to mark as completed anyway
   */
  overrideCompletion: managerProcedure
    .input(
      z.object({
        jobId: z.string(),
        reason: z.string().min(10, "Reason must be at least 10 characters"),
        gpsLat: z.number(),
        gpsLng: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      if (ctx.user.role !== "manager" && ctx.user.role !== "super_manager") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can override job completion",
        });
      }

      const result = await db.transaction(async (tx: any) => {
        // 1. Get job and verify it exists
        const job = await tx.query.cleaningJobs.findFirst({
          where: and(
            eq(cleaningJobs.id, input.jobId),
            eq(cleaningJobs.businessId, ctx.user.businessId)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }

        // 2. Detect conflicts (for audit log)
        const conflicts = await detectJobConflicts(
          tx,
          input.jobId,
          input.gpsLat,
          input.gpsLng
        );

        const previousStatus = job.status;

        // 3. Update job to completed (force override)
        const updated = await tx
          .update(cleaningJobs)
          .set({
            status: "completed",
            completedAt: new Date(),
            gpsEndLat: input.gpsLat.toString(),
            gpsEndLng: input.gpsLng.toString(),
            overriddenBy: ctx.user.id,
            overrideReason: input.reason,
            overriddenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cleaningJobs.id, input.jobId));

        if (updated.rowsAffected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Job could not be updated (may have been modified)",
          });
        }

        // 4. Return updated job with override info
        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return {
          job: updatedJob,
          override: {
            managerId: ctx.user.id,
            reason: input.reason,
            previousStatus,
            newStatus: "completed",
            conflictsResolved: conflicts,
            overriddenAt: new Date(),
          },
        };
      });

      return result;
    }),

  /**
   * Resolve GPS conflict (manager verifies cleaner was at property)
   * 
   * Allows job completion even if GPS validation failed.
   * Manager takes responsibility for verification.
   */
  resolveGPSConflict: managerProcedure
    .input(
      z.object({
        jobId: z.string(),
        reason: z.string().min(10, "Reason must be at least 10 characters"),
        gpsLat: z.number(),
        gpsLng: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      if (ctx.user.role !== "manager" && ctx.user.role !== "super_manager") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can resolve GPS conflicts",
        });
      }

      const result = await db.transaction(async (tx: any) => {
        // 1. Get job
        const job = await tx.query.cleaningJobs.findFirst({
          where: and(
            eq(cleaningJobs.id, input.jobId),
            eq(cleaningJobs.businessId, ctx.user.businessId)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }

        // 2. Verify GPS conflict exists
        const property = await tx.query.properties.findFirst({
          where: eq(properties.id, job.propertyId),
          columns: { latitude: true, longitude: true },
        });

        if (!property?.latitude || !property?.longitude) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Property coordinates not available",
          });
        }

        const distance = calculateDistance(
          property.latitude,
          property.longitude,
          input.gpsLat,
          input.gpsLng
        );

        if (distance <= 50) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "GPS location is within acceptable range. No conflict to resolve.",
          });
        }

        // 3. Update job (GPS conflict resolved)
        const updated = await tx
          .update(cleaningJobs)
          .set({
            gpsEndLat: input.gpsLat.toString(),
            gpsEndLng: input.gpsLng.toString(),
            overriddenBy: ctx.user.id,
            overrideReason: `GPS conflict resolved: ${input.reason}`,
            overriddenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cleaningJobs.id, input.jobId));

        if (updated.rowsAffected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Job could not be updated",
          });
        }

        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return {
          job: updatedJob,
          resolution: {
            type: "gps_conflict_resolved",
            distance,
            reason: input.reason,
            resolvedBy: ctx.user.id,
            resolvedAt: new Date(),
          },
        };
      });

      return result;
    }),

  /**
   * Resolve photo conflict (manager verifies photos exist elsewhere)
   * 
   * Allows job completion even if photos weren't uploaded through app.
   * Manager takes responsibility for verification.
   */
  resolvePhotoConflict: managerProcedure
    .input(
      z.object({
        jobId: z.string(),
        reason: z.string().min(10, "Reason must be at least 10 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      if (ctx.user.role !== "manager" && ctx.user.role !== "super_manager") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can resolve photo conflicts",
        });
      }

      const result = await db.transaction(async (tx: any) => {
        // 1. Get job
        const job = await tx.query.cleaningJobs.findFirst({
          where: and(
            eq(cleaningJobs.id, input.jobId),
            eq(cleaningJobs.businessId, ctx.user.businessId)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }

        // 2. Verify photo conflict exists
        const photos = await tx.query.media.findMany({
          where: and(eq(media.jobId, input.jobId), eq(media.type, "photo")),
        });

        if (photos.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Photos already uploaded for this job. No conflict to resolve.",
          });
        }

        // 3. Update job (photo conflict resolved)
        const updated = await tx
          .update(cleaningJobs)
          .set({
            overriddenBy: ctx.user.id,
            overrideReason: `Photo conflict resolved: ${input.reason}`,
            overriddenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cleaningJobs.id, input.jobId));

        if (updated.rowsAffected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Job could not be updated",
          });
        }

        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return {
          job: updatedJob,
          resolution: {
            type: "photo_conflict_resolved",
            reason: input.reason,
            resolvedBy: ctx.user.id,
            resolvedAt: new Date(),
          },
        };
      });

      return result;
    }),
};
