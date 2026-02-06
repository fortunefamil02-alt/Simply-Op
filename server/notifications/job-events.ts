/**
 * Job Lifecycle Event Emitters
 *
 * These functions emit events at key points in the job workflow.
 * Events trigger notifications via the event-driven system.
 */

import type { CleaningJob, Booking, User, DamageReport } from "@/drizzle/schema";
import { emitNotificationEvent } from "./delivery";
import { lockJobChat } from "./job-chat";
import type {
  JobAvailableEvent,
  JobAssignedEvent,
  JobAcceptedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobCancelledEvent,
  JobReassignedEvent,
  DamageReportedEvent,
  CleanerRemovedEvent,
  CleanerOverrideRequestEvent,
  GPSMismatchEvent,
  BookingDateChangedEvent,
  InvoiceSubmittedEvent,
  InvoicePeriodReadyEvent,
  AccessDeniedEvent,
} from "./events";

// ============================================================================
// JOB LIFECYCLE EVENTS
// ============================================================================

/**
 * Emit when a new job is created and available
 */
export async function emitJobAvailable(
  job: CleaningJob,
  property: { name: string },
  businessUsers: User[]
): Promise<void> {
  const event: JobAvailableEvent = {
    type: "job_available",
    jobId: job.id,
    businessId: job.businessId,
    propertyId: job.propertyId,
    cleaningDate: job.cleaningDate,
    price: Number(job.price),
    propertyName: property.name,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job available: ${job.id}`);
}

/**
 * Emit when a job is assigned to a cleaner
 */
export async function emitJobAssigned(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  businessUsers: User[]
): Promise<void> {
  const event: JobAssignedEvent = {
    type: "job_assigned",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    propertyId: job.propertyId,
    propertyName: property.name,
    cleaningDate: job.cleaningDate,
    price: Number(job.price),
    instructions: job.instructions || undefined,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job assigned: ${job.id} to ${cleaner.id}`);
}

/**
 * Emit when a cleaner accepts a job
 */
export async function emitJobAccepted(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  businessUsers: User[]
): Promise<void> {
  const event: JobAcceptedEvent = {
    type: "job_accepted",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job accepted: ${job.id} by ${cleaner.id}`);
}

/**
 * Emit when job starts (first photo uploaded)
 */
export async function emitJobStarted(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  businessUsers: User[]
): Promise<void> {
  const event: JobStartedEvent = {
    type: "job_started",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    startedAt: job.startedAt || new Date(),
    gpsLat: Number(job.gpsStartLat || 0),
    gpsLng: Number(job.gpsStartLng || 0),
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job started: ${job.id}`);
}

/**
 * Emit when job is completed
 */
export async function emitJobCompleted(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  photoCount: number,
  damageCount: number,
  businessUsers: User[]
): Promise<void> {
  const event: JobCompletedEvent = {
    type: "job_completed",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    completedAt: job.completedAt || new Date(),
    gpsLat: Number(job.gpsEndLat || 0),
    gpsLng: Number(job.gpsEndLng || 0),
    photoCount,
    damageCount,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);

  // Lock chat when job completes
  await lockJobChat(job.id, job, businessUsers);

  console.log(`[Events] Job completed: ${job.id}`);
}

/**
 * Emit when job is cancelled
 */
export async function emitJobCancelled(
  job: CleaningJob,
  property: { name: string },
  reason: string | undefined,
  businessUsers: User[]
): Promise<void> {
  const event: JobCancelledEvent = {
    type: "job_cancelled",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: job.assignedCleanerId || undefined,
    propertyId: job.propertyId,
    propertyName: property.name,
    reason,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job cancelled: ${job.id}`);
}

/**
 * Emit when job is reassigned to a different cleaner
 */
export async function emitJobReassigned(
  job: CleaningJob,
  previousCleaner: User,
  newCleaner: User,
  property: { name: string },
  reason: string | undefined,
  businessUsers: User[]
): Promise<void> {
  const event: JobReassignedEvent = {
    type: "job_reassigned",
    jobId: job.id,
    businessId: job.businessId,
    previousCleanerId: previousCleaner.id,
    previousCleanerName:
      `${previousCleaner.firstName || ""} ${previousCleaner.lastName || ""}`.trim() ||
      previousCleaner.email,
    newCleanerId: newCleaner.id,
    newCleanerName:
      `${newCleaner.firstName || ""} ${newCleaner.lastName || ""}`.trim() || newCleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    reason,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Job reassigned: ${job.id} from ${previousCleaner.id} to ${newCleaner.id}`);
}

// ============================================================================
// CRITICAL ALERT EVENTS
// ============================================================================

/**
 * Emit when damage is reported (CRITICAL)
 */
export async function emitDamageReported(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  damage: DamageReport,
  photoCount: number,
  businessUsers: User[]
): Promise<void> {
  const event: DamageReportedEvent = {
    type: "damage_reported",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    severity: damage.severity,
    description: damage.description,
    photoCount,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Damage reported: ${job.id} - ${damage.severity}`);
}

/**
 * Emit when cleaner is removed (CRITICAL)
 */
export async function emitCleanerRemoved(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  reason: "guest_present" | "access_denied" | "other",
  businessUsers: User[]
): Promise<void> {
  const event: CleanerRemovedEvent = {
    type: "cleaner_removed",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    reason,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Cleaner removed: ${job.id} - ${reason}`);
}

/**
 * Emit when cleaner requests override (CRITICAL)
 */
export async function emitCleanerOverrideRequest(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  reason: string,
  businessUsers: User[]
): Promise<void> {
  const event: CleanerOverrideRequestEvent = {
    type: "cleaner_override_request",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    reason,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Override requested: ${job.id} - ${reason}`);
}

/**
 * Emit when GPS coordinates don't match (CRITICAL)
 */
export async function emitGPSMismatch(
  job: CleaningJob,
  cleaner: User,
  property: { name: string; latitude: number; longitude: number },
  cleanerLat: number,
  cleanerLng: number,
  distanceMeters: number,
  businessUsers: User[]
): Promise<void> {
  const event: GPSMismatchEvent = {
    type: "gps_mismatch",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    propertyLat: property.latitude,
    propertyLng: property.longitude,
    cleanerLat,
    cleanerLng,
    distanceMeters,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] GPS mismatch: ${job.id} - ${distanceMeters}m away`);
}

/**
 * Emit when access is denied (CRITICAL)
 */
export async function emitAccessDenied(
  job: CleaningJob,
  cleaner: User,
  property: { name: string },
  gpsLat: number,
  gpsLng: number,
  businessUsers: User[]
): Promise<void> {
  const event: AccessDeniedEvent = {
    type: "access_denied",
    jobId: job.id,
    businessId: job.businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    propertyId: job.propertyId,
    propertyName: property.name,
    gpsLat,
    gpsLng,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Access denied: ${job.id}`);
}

// ============================================================================
// BOOKING & INVOICE EVENTS
// ============================================================================

/**
 * Emit when booking date changes (extended stay)
 */
export async function emitBookingDateChanged(
  job: CleaningJob,
  booking: Booking,
  oldCheckoutDate: Date,
  newCheckoutDate: Date,
  property: { name: string },
  businessUsers: User[]
): Promise<void> {
  const cleaner = businessUsers.find((u) => u.id === job.assignedCleanerId);

  const event: BookingDateChangedEvent = {
    type: "booking_date_changed",
    jobId: job.id,
    businessId: job.businessId,
    propertyId: job.propertyId,
    propertyName: property.name,
    oldCheckoutDate,
    newCheckoutDate,
    cleanerId: cleaner?.id,
    cleanerName: cleaner ? `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email : undefined,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Booking date changed: ${job.id}`);
}

/**
 * Emit when invoice is submitted
 */
export async function emitInvoiceSubmitted(
  invoiceId: string,
  businessId: string,
  cleaner: User,
  totalAmount: number,
  jobCount: number,
  periodStart: Date,
  periodEnd: Date,
  businessUsers: User[]
): Promise<void> {
  const event: InvoiceSubmittedEvent = {
    type: "invoice_submitted",
    invoiceId,
    businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    totalAmount,
    jobCount,
    periodStart,
    periodEnd,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Invoice submitted: ${invoiceId}`);
}

/**
 * Emit when invoice period is ready
 */
export async function emitInvoicePeriodReady(
  invoiceId: string,
  businessId: string,
  cleaner: User,
  totalAmount: number,
  jobCount: number,
  periodStart: Date,
  periodEnd: Date,
  businessUsers: User[]
): Promise<void> {
  const event: InvoicePeriodReadyEvent = {
    type: "invoice_period_ready",
    businessId,
    cleanerId: cleaner.id,
    cleanerName: `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || cleaner.email,
    invoiceId,
    totalAmount,
    jobCount,
    periodStart,
    periodEnd,
    timestamp: new Date(),
  };

  await emitNotificationEvent(event, businessUsers);
  console.log(`[Events] Invoice period ready: ${invoiceId}`);
}
