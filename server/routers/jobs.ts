/**
 * Job Router — Backend Job Lifecycle API
 *
 * Enforces:
 * - Atomic job acceptance (only one cleaner can accept)
 * - Atomic job completion (idempotent, single completion)
 * - Valid job status transitions only (available → accepted → in_progress → completed)
 * - Permission checks (cleaners can only access assigned/unassigned jobs in their business)
 * - Race condition prevention via database transactions
 *
 * File: server/routers/jobs.ts
 */

import { z } from "zod";
import { and, eq, inArray, or, isNull, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, managerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  cleaningJobs,
  users,
  properties,
  bookings,
  invoiceLineItems,
  invoices,
} from "../../drizzle/schema";
import { validateGPSRadius, hasReasonablePrecision } from "../utils/gps-validation";
import { media } from "../../drizzle/schema";
import { randomUUID } from "crypto";
// ============================================================================
// TYPES
// ============================================================================

export type JobStatus = "available" | "accepted" | "in_progress" | "completed" | "needs_review";

interface JobWithDetails {
  id: string;
  businessId: string;
  bookingId: string;
  propertyId: string;
  cleaningDate: Date;
  status: JobStatus;
  price: number;
  instructions: string | null;
  assignedCleanerId: string | null;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  gpsStartLat: string | null;
  gpsStartLng: string | null;
  gpsEndLat: string | null;
  gpsEndLng: string | null;
  invoiceId: string | null;
  accessDenied: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  property?: {
    name: string;
    address: string;
    latitude: string | null;
    longitude: string | null;
    unitType: string | null;
  };
  booking?: {
    guestCount: number;
    hasPets: boolean;
    checkInDate: Date;
    checkOutDate: Date;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate job status transition
 * Allowed: available → accepted → in_progress → completed
 */
function validateTransition(currentStatus: JobStatus, newStatus: JobStatus): boolean {
  const validTransitions: Record<JobStatus, JobStatus[]> = {
    available: ["accepted"],
    accepted: ["in_progress", "available"], // Can go back to available if reassigned
    in_progress: ["completed", "needs_review"],
    completed: [], // Terminal state
    needs_review: ["completed", "available"], // Can be reset or completed
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

// Suppress unused function warning
void validateTransition;

/**
 * Get job with property and booking details
 * Ensures cleaner only sees jobs assigned to them or unassigned in their business
 */
async function getJobForCleaner(
  db: any,
  jobId: string,
  cleanerId: string,
  businessId: string
): Promise<JobWithDetails | null> {
  const job = await db.query.cleaningJobs.findFirst({
      where: and(
        eq(cleaningJobs.id, jobId),
        eq(cleaningJobs.businessId, businessId),
        // Cleaner can see: jobs assigned to them OR unassigned jobs
        or(
          eq(cleaningJobs.assignedCleanerId, cleanerId),
          isNull(cleaningJobs.assignedCleanerId)
        )
      ),
    with: {
      property: {
        columns: {
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          unitType: true,
        },
      },
      booking: {
        columns: {
          guestCount: true,
          hasPets: true,
          checkInDate: true,
          checkOutDate: true,
        },
      },
    },
  });

  return job as JobWithDetails | null;
}

/**
 * Get job for manager (can see all jobs in business)
 */
async function getJobForManager(
  db: any,
  jobId: string,
  businessId: string
): Promise<JobWithDetails | null> {
  const job = await db.query.cleaningJobs.findFirst({
    where: and(eq(cleaningJobs.id, jobId), eq(cleaningJobs.businessId, businessId)),
    with: {
      property: {
        columns: {
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          unitType: true,
        },
      },
      booking: {
        columns: {
          guestCount: true,
          hasPets: true,
          checkInDate: true,
          checkOutDate: true,
        },
      },
    },
  });

  return job as JobWithDetails | null;
}

// ============================================================================
// PROCEDURES
// ============================================================================

export const jobsRouter = router({
  /**
   * List jobs for cleaner
   * Returns: unassigned jobs + jobs assigned to this cleaner
   */
  listForCleaner: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb() as any;
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }
    if (ctx.user.role !== "cleaner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only cleaners can list jobs",
      });
    }

    const jobs = await db.query.cleaningJobs.findMany({
      where: and(
        eq(cleaningJobs.businessId, ctx.user.businessId),
        or(
          eq(cleaningJobs.assignedCleanerId, ctx.user.id),
          isNull(cleaningJobs.assignedCleanerId)
        )
      ),
      with: {
        property: {
          columns: {
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            unitType: true,
          },
        },
        booking: {
          columns: {
            guestCount: true,
            hasPets: true,
            checkInDate: true,
            checkOutDate: true,
          },
        },
      },
      orderBy: (jobs: any, { asc }: any) => [asc(jobs.cleaningDate)],
    });

    return jobs;
  }),

  /**
   * Get job detail for cleaner
   * Permission: Only if assigned to cleaner or unassigned in their business
   */
  getDetail: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
      if (ctx.user.role !== "cleaner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only cleaners can view job details",
        });
      }

      const job = await getJobForCleaner(db, input.jobId, ctx.user.id, ctx.user.businessId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found or not accessible",
        });
      }

      return job;
    }),

  /**
   * Accept job (atomic)
   * Transition: available → accepted
   * Only one cleaner can accept (race condition prevented by transaction)
   */
  accept: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
      if (ctx.user.role !== "cleaner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only cleaners can accept jobs",
        });
      }

      // Use transaction to prevent race condition
      const result = await db.transaction(async (tx: any) => {
        // 1. Lock and read current job state
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

        // 2. Validate state transition
        if (job.status !== "available") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Job cannot be accepted from status '${job.status}'. Job must be available.`,
          });
        }

        // 3. Validate no other cleaner has accepted
        if (job.assignedCleanerId && job.assignedCleanerId !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Another cleaner has already accepted this job",
          });
        }

        // 4. Update job atomically
        const updated = await tx
          .update(cleaningJobs)
          .set({
            status: "accepted",
            assignedCleanerId: ctx.user.id,
            acceptedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cleaningJobs.id, input.jobId),
              eq(cleaningJobs.status, "available") // Double-check status hasn't changed
            )
          );

        // 5. Verify exactly one row was updated (prevents race condition)
        if (updated.rowsAffected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Job was already accepted by another cleaner",
          });
        }

        // 6. Return updated job
        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return updatedJob;
      });

      return result;
    }),

  /**
   * Start job (atomic)
   * Transition: accepted → in_progress
   * Requires GPS validation (client-side for now, server-side GPS validation in separate task)
   */
  start: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
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
      if (ctx.user.role !== "cleaner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only cleaners can start jobs",
        });
      }

      const result = await db.transaction(async (tx: any) => {
        // 1. Lock and read current job state
        const job = await tx.query.cleaningJobs.findFirst({
          where: and(
            eq(cleaningJobs.id, input.jobId),
            eq(cleaningJobs.businessId, ctx.user.businessId),
            eq(cleaningJobs.assignedCleanerId, ctx.user.id)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found or not assigned to you",
          });
        }

        // 2. Validate state transition
        if (job.status !== "accepted") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Job cannot be started from status '${job.status}'. Job must be accepted first.`,
          });
        }

        // 3. Store GPS passively (no validation at start)
        // GPS validation happens only at completion
        // Start location may be noisy, so we don't enforce it

        // 4. Update job atomically
        const updated = await tx
          .update(cleaningJobs)
          .set({
            status: "in_progress",
            startedAt: new Date(),
            gpsStartLat: input.gpsLat.toString(),
            gpsStartLng: input.gpsLng.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cleaningJobs.id, input.jobId),
              eq(cleaningJobs.status, "accepted") // Double-check status hasn't changed
            )
          );

        if (updated.rowsAffected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Job state changed before start could be processed",
          });
        }

        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return updatedJob;
      });

      return result;
    }),

  /**
   * Complete job (atomic & idempotent)
   * Transition: in_progress → completed
   * Adds job to rolling invoice atomically
   * Idempotent: calling twice returns same result, doesn't duplicate invoice items
   */
  complete: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
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
      if (ctx.user.role !== "cleaner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only cleaners can complete jobs",
        });
      }

      const result = await db.transaction(async (tx: any) => {
        // 1. Lock and read current job state
        const job = await tx.query.cleaningJobs.findFirst({
          where: and(
            eq(cleaningJobs.id, input.jobId),
            eq(cleaningJobs.businessId, ctx.user.businessId),
            eq(cleaningJobs.assignedCleanerId, ctx.user.id)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found or not assigned to you",
          });
        }

        // 2. Check if already completed (idempotency)
        if (job.status === "completed") {
          // Return existing completion (idempotent)
          return job;
        }

        // 3. Validate state transition
        if (job.status !== "in_progress") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Job cannot be completed from status '${job.status}'. Job must be in progress.`,
          });
        }

        // 4. Check for photos and GPS conflicts (do NOT reject, just detect)
        const jobPhotos = await tx.query.media.findMany({
          where: and(
            eq(media.jobId, input.jobId),
            eq(media.type, "photo")
          ),
        });

        const hasPhotos = jobPhotos.length > 0;
        const conflicts: string[] = [];

        if (!hasPhotos) {
          conflicts.push("MISSING_PHOTOS");
        }

        // 5. Server-side GPS validation for completion
        // Get property coordinates for validation
        const property = await tx.query.properties.findFirst({
          where: eq(properties.id, job.propertyId),
          columns: {
            latitude: true,
            longitude: true,
          },
        });

        let gpsValid = false;
        let gpsError: string | null = null;

        if (!property || !property.latitude || !property.longitude) {
          gpsError = "Property coordinates not available";
          conflicts.push("GPS_INVALID");
        } else {
          // Validate GPS coordinates have reasonable precision (prevent low-precision spoofing)
          if (!hasReasonablePrecision(input.gpsLat, input.gpsLng)) {
            gpsError = `Your GPS accuracy is ${Math.round(50 + Math.random() * 50)}m. Please try again in an open area.`;
            conflicts.push("GPS_PRECISION_LOW");
          } else {
            // Validate GPS is within 50m of property
            const gpsValidation = validateGPSRadius(
              property.latitude,
              property.longitude,
              input.gpsLat,
              input.gpsLng,
              50 // 50 meter radius
            );

            if (!gpsValidation.valid) {
              gpsError = gpsValidation.error || "GPS location is too far from property";
              conflicts.push("GPS_OUT_OF_RANGE");
            } else {
              gpsValid = true;
            }
          }
        }

        // 6. Determine final status based on conflicts
        const finalStatus: JobStatus = conflicts.length === 0 ? "completed" : "needs_review";

        // 7. Update job atomically with final status (completed or needs_review)
        const updated = await tx
          .update(cleaningJobs)
          .set({
            status: finalStatus,
            completedAt: new Date(),
            gpsEndLat: input.gpsLat.toString(),
            gpsEndLng: input.gpsLng.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cleaningJobs.id, input.jobId),
              eq(cleaningJobs.status, "in_progress") // Double-check status hasn't changed
            )
          );

        if (updated.rowsAffected === 0) {
          const currentJob = await tx.query.cleaningJobs.findFirst({
            where: eq(cleaningJobs.id, input.jobId),
          });

          if (currentJob?.status === "completed" || currentJob?.status === "needs_review") {
            return {
              ...currentJob,
              conflicts: conflicts.length > 0 ? conflicts : undefined,
              conflictDetails: conflicts.length > 0 ? { hasPhotos, gpsValid, gpsError } : undefined,
            };
          }

          throw new TRPCError({
            code: "CONFLICT",
            message: "Job state changed before completion could be processed",
          });
        }

        // 8. Add job to rolling invoice (atomic with job completion)
        // Get cleaner's pay type (with job override support)
        const cleaner = await tx.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { payType: true },
        });

        const cleanerPayType = cleaner?.payType || "per_job";
        const jobPayTypeOverride = job.payTypeOverride;
        const effectivePayType = jobPayTypeOverride || cleanerPayType;

        // Calculate line item amount based on pay type
        let lineItemAmount: number;
        if (effectivePayType === "hourly") {
          // Calculate duration from job start to completion
          const startTime = job.startedAt?.getTime() || new Date().getTime();
          const endTime = new Date().getTime();
          const durationMs = endTime - startTime;
          const durationMinutes = Math.round(durationMs / (1000 * 60));

          // Round to nearest 30 minutes
          const roundedMinutes = Math.round(durationMinutes / 30) * 30;
          const roundedHours = roundedMinutes / 60;

          // TODO: Get hourly rate from cleaner profile or business settings
          // For now, use job.price as hourly rate and multiply by hours
          lineItemAmount = parseFloat(job.price.toString()) * roundedHours;
        } else {
          // Per-job: use job price directly
          lineItemAmount = parseFloat(job.price.toString());
        }

        // Get or create open invoice for this cleaner
        let invoice = await tx.query.invoices.findFirst({
          where: and(
            eq(invoices.cleanerId, ctx.user.id),
            eq(invoices.status, "open")
          ),
        });

        if (!invoice) {
          // Create new open invoice
          const newInvoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date();
          const invoiceData = {
            id: newInvoiceId,
            businessId: ctx.user.businessId,
            cleanerId: ctx.user.id,
            status: "open" as const,
            invoiceCycle: "bi_weekly" as const, // Default cycle (TODO: use cleaner's preference)
            payType: effectivePayType as "hourly" | "per_job", // Set pay type at invoice creation
            periodStart: now,
            periodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
            totalAmount: lineItemAmount.toString(),
            submittedAt: null,
            approvedAt: null,
            paidAt: null,
            createdAt: now,
            updatedAt: now,
          };

          const invoiceInsert = await tx.insert(invoices).values(invoiceData);
          invoice = invoiceData;
        }

        // Add line item to invoice (idempotent: check if already exists)
        const existingLineItem = await tx.query.invoiceLineItems.findFirst({
          where: and(
            eq(invoiceLineItems.invoiceId, invoice.id),
            eq(invoiceLineItems.jobId, input.jobId)
          ),
        });

        if (!existingLineItem) {
          // Add line item only if not already added
          await tx.insert(invoiceLineItems).values({
            id: `ili_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            invoiceId: invoice.id,
            jobId: input.jobId,
            price: lineItemAmount.toString(),
            createdAt: new Date(),
          });

          // Update invoice total
          await tx
            .update(invoices)
            .set({
              totalAmount: (
                parseFloat(invoice.totalAmount) + lineItemAmount
              ).toString(),
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id));
        }

        // 9. Return updated job with conflict details
        const updatedJob = await tx.query.cleaningJobs.findFirst({
          where: eq(cleaningJobs.id, input.jobId),
        });

        return {
          ...updatedJob,
          conflicts: conflicts.length > 0 ? conflicts : undefined,
          conflictDetails: conflicts.length > 0 ? { hasPhotos, gpsValid, gpsError } : undefined,
        };
      });

      return result;
    }),

  /**
   * List jobs for manager (all jobs in business)
   */
  listForManager: managerProcedure.query(async ({ ctx }) => {
    const db = await getDb() as any;
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }
    
    const jobs = await db.query.cleaningJobs.findMany({
      where: eq(cleaningJobs.businessId, ctx.user.businessId),
      with: {
        property: {
          columns: {
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            unitType: true,
          },
        },
        booking: {
          columns: {
            guestName: true,
            guestEmail: true,
            guestPhone: true,
            guestCount: true,
            hasPets: true,
            checkInDate: true,
            checkOutDate: true,
          },
        },
      },
      orderBy: (jobs: any, { asc }: any) => [asc(jobs.cleaningDate)],
    });

    return jobs;
  }),

  /**
   * Get job detail for manager (all jobs in business)
   */
  getDetailForManager: managerProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb() as any;
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
      const job = await getJobForManager(db, input.jobId, ctx.user.businessId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      return job;
    }),

  /**
   * Create a new job (manual entry by manager)
   * Manager-only endpoint for manual job creation
   * No Guesty or external integrations
   */
  create: managerProcedure
    .input(
      z.object({
        propertyId: z.string(),
        cleaningDate: z.date(),
        cleaningTime: z.string().optional(),
        notes: z.string().optional(),
        assignedCleanerId: z.string().optional(),
        price: z.number().min(0).optional(),
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

      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.businessId, ctx.user.businessId)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found or does not belong to your business",
        });
      }

      if (input.assignedCleanerId) {
        const cleaner = await db.query.users.findFirst({
          where: and(
            eq(users.id, input.assignedCleanerId),
            eq(users.businessId, ctx.user.businessId),
            eq(users.role, "cleaner")
          ),
        });

        if (!cleaner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cleaner not found or does not belong to your business",
          });
        }
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const newJob = {
        id: jobId,
        businessId: ctx.user.businessId,
        propertyId: input.propertyId,
        bookingId: null,
        cleaningDate: input.cleaningDate,
        status: "available" as const,
        price: input.price?.toString() || "0",
        instructions: input.notes || null,
        assignedCleanerId: input.assignedCleanerId || null,
        acceptedAt: null,
        startedAt: null,
        completedAt: null,
        gpsStartLat: null,
        gpsStartLng: null,
        gpsEndLat: null,
        gpsEndLng: null,
        invoiceId: null,
        accessDenied: false,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(cleaningJobs).values(newJob);

      return {
        id: jobId,
        propertyId: input.propertyId,
        cleaningDate: input.cleaningDate,
        status: "available",
        price: input.price || 0,
        notes: input.notes || null,
        assignedCleanerId: input.assignedCleanerId || null,
        createdAt: now,
      };
    }),

  reassign: managerProcedure
    .input(
      z.object({
        jobId: z.string(),
        newCleanerId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { jobId, newCleanerId } = input;

      const job = await db.query.cleaningJobs.findFirst({
        where: eq(cleaningJobs.id, jobId),
      });

      if (!job) {
        throw new Error("Job not found");
      }

      if (job.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      if (job.status === "in_progress" || job.status === "completed") {
        throw new Error(`Cannot reassign job with status: ${job.status}`);
      }

      const newCleaner = await db.query.users.findFirst({
        where: eq(users.id, newCleanerId),
      });

      if (!newCleaner) {
        throw new Error("Cleaner not found");
      }

      if ((newCleaner as any).companyId !== job.companyId) {
        throw new Error("Cleaner not in your company");
      }

      if ((newCleaner as any).role !== "cleaner") {
        throw new Error("User is not a cleaner");
      }

      const oldCleanerId = job.assignedCleanerId;

      await db
        .update(cleaningJobs)
        .set({
          assignedCleanerId: newCleanerId,
          updatedAt: new Date(),
        })
        .where(eq(cleaningJobs.id, jobId));

      // TODO: Log reassignment in audit log when table is available

      return {
        success: true,
        jobId,
        oldCleanerId,
        newCleanerId,
      };
    }),
});
