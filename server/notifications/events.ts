/**
 * Event-Driven Notification System for Simply Organized
 *
 * This module defines all system events that trigger notifications.
 * Events are fired by business logic, not UI actions.
 * Notifications are delivered based on role-based rules.
 */

import type { CleaningJob, User, Booking, DamageReport, JobChat } from "@/drizzle/schema";

// ============================================================================
// EVENT TYPES
// ============================================================================

export type NotificationEvent =
  | JobAvailableEvent
  | JobAssignedEvent
  | JobAcceptedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobCancelledEvent
  | JobReassignedEvent
  | DamageReportedEvent
  | CleanerRemovedEvent
  | CleanerOverrideRequestEvent
  | GPSMismatchEvent
  | BookingDateChangedEvent
  | InvoiceSubmittedEvent
  | InvoicePeriodReadyEvent
  | MessageReceivedEvent
  | ChatLockedEvent
  | AccessDeniedEvent;

// ============================================================================
// EVENT DEFINITIONS
// ============================================================================

/**
 * Fired when a new cleaning job is created and available for assignment
 * Delivery: All cleaners in the business
 */
export interface JobAvailableEvent {
  type: "job_available";
  jobId: string;
  businessId: string;
  propertyId: string;
  cleaningDate: Date;
  price: number;
  propertyName: string;
  timestamp: Date;
}

/**
 * Fired when a job is directly assigned to a cleaner by a manager
 * Delivery: Assigned cleaner
 */
export interface JobAssignedEvent {
  type: "job_assigned";
  jobId: string;
  businessId: string;
  cleanerId: string;
  propertyId: string;
  propertyName: string;
  cleaningDate: Date;
  price: number;
  instructions?: string;
  timestamp: Date;
}

/**
 * Fired when a cleaner accepts a job
 * Delivery: All other cleaners (job no longer available), assigned manager
 */
export interface JobAcceptedEvent {
  type: "job_accepted";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  timestamp: Date;
}

/**
 * Fired when first photo is uploaded (job timer starts)
 * Delivery: Assigned manager
 */
export interface JobStartedEvent {
  type: "job_started";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  startedAt: Date;
  gpsLat: number;
  gpsLng: number;
  timestamp: Date;
}

/**
 * Fired when cleaner marks job as done
 * Delivery: Assigned manager, invoice system
 */
export interface JobCompletedEvent {
  type: "job_completed";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  completedAt: Date;
  gpsLat: number;
  gpsLng: number;
  photoCount: number;
  damageCount: number;
  timestamp: Date;
}

/**
 * Fired when a job is cancelled by manager
 * Delivery: Assigned cleaner, other cleaners (job becomes available again)
 */
export interface JobCancelledEvent {
  type: "job_cancelled";
  jobId: string;
  businessId: string;
  cleanerId?: string;
  propertyId: string;
  propertyName: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Fired when a job is reassigned to a different cleaner
 * Delivery: Previous cleaner, new cleaner, manager
 */
export interface JobReassignedEvent {
  type: "job_reassigned";
  jobId: string;
  businessId: string;
  previousCleanerId: string;
  previousCleanerName: string;
  newCleanerId: string;
  newCleanerName: string;
  propertyId: string;
  propertyName: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Fired when damage is reported (CRITICAL ALERT)
 * Delivery: Assigned manager (high priority, bypass quiet hours)
 */
export interface DamageReportedEvent {
  type: "damage_reported";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  severity: "minor" | "moderate" | "severe";
  description: string;
  photoCount: number;
  timestamp: Date;
}

/**
 * Fired when cleaner is removed after arriving at property (CRITICAL ALERT)
 * Delivery: Assigned manager (high priority, bypass quiet hours)
 */
export interface CleanerRemovedEvent {
  type: "cleaner_removed";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  reason: "guest_present" | "access_denied" | "other";
  timestamp: Date;
}

/**
 * Fired when cleaner requests manager override (CRITICAL ALERT)
 * Delivery: Assigned manager (high priority, bypass quiet hours)
 */
export interface CleanerOverrideRequestEvent {
  type: "cleaner_override_request";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  reason: string;
  timestamp: Date;
}

/**
 * Fired when GPS coordinates don't match property at completion (CRITICAL ALERT)
 * Delivery: Assigned manager (high priority, bypass quiet hours)
 */
export interface GPSMismatchEvent {
  type: "gps_mismatch";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  propertyLat: number;
  propertyLng: number;
  cleanerLat: number;
  cleanerLng: number;
  distanceMeters: number;
  timestamp: Date;
}

/**
 * Fired when booking checkout date changes (extended stay)
 * Delivery: Assigned cleaner, assigned manager
 */
export interface BookingDateChangedEvent {
  type: "booking_date_changed";
  jobId: string;
  businessId: string;
  propertyId: string;
  propertyName: string;
  oldCheckoutDate: Date;
  newCheckoutDate: Date;
  cleanerId?: string;
  cleanerName?: string;
  timestamp: Date;
}

/**
 * Fired when cleaner submits invoice
 * Delivery: Assigned manager
 */
export interface InvoiceSubmittedEvent {
  type: "invoice_submitted";
  invoiceId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  totalAmount: number;
  jobCount: number;
  periodStart: Date;
  periodEnd: Date;
  timestamp: Date;
}

/**
 * Fired when invoice period is ready for submission
 * Delivery: Assigned cleaner
 */
export interface InvoicePeriodReadyEvent {
  type: "invoice_period_ready";
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  invoiceId: string;
  totalAmount: number;
  jobCount: number;
  periodStart: Date;
  periodEnd: Date;
  timestamp: Date;
}

/**
 * Fired when a message is sent in job chat
 * Delivery: Other participant (cleaner or manager)
 */
export interface MessageReceivedEvent {
  type: "message_received";
  messageId: string;
  jobId: string;
  businessId: string;
  senderId: string;
  senderName: string;
  senderRole: "manager" | "cleaner";
  recipientId: string;
  message: string;
  timestamp: Date;
}

/**
 * Fired when job is completed and chat is locked
 * Delivery: Both participants
 */
export interface ChatLockedEvent {
  type: "chat_locked";
  jobId: string;
  businessId: string;
  cleanerId: string;
  managerId: string;
  timestamp: Date;
}

/**
 * Fired when cleaner arrives but guest is present (access denied)
 * Delivery: Assigned manager
 */
export interface AccessDeniedEvent {
  type: "access_denied";
  jobId: string;
  businessId: string;
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  gpsLat: number;
  gpsLng: number;
  timestamp: Date;
}

// ============================================================================
// NOTIFICATION RULES
// ============================================================================

export interface NotificationRule {
  event: NotificationEvent["type"];
  role: "super_manager" | "manager" | "cleaner";
  title: (event: NotificationEvent) => string;
  message: (event: NotificationEvent) => string;
  isCritical: boolean; // Bypass quiet hours if true
  recipientIds: (event: NotificationEvent, businessUsers: User[]) => string[];
}

export const NOTIFICATION_RULES: NotificationRule[] = [
  // ========== CLEANER NOTIFICATIONS ==========
  {
    event: "job_available",
    role: "cleaner",
    title: () => "New Job Available",
    message: (e: NotificationEvent) => {
      const event = e as JobAvailableEvent;
      return `${event.propertyName} on ${event.cleaningDate.toLocaleDateString()} - $${event.price}`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as JobAvailableEvent;
      return users
        .filter((u) => u.role === "cleaner" && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "job_assigned",
    role: "cleaner",
    title: () => "Job Assigned to You",
    message: (e: NotificationEvent) => {
      const event = e as JobAssignedEvent;
      return `${event.propertyName} on ${event.cleaningDate.toLocaleDateString()} - $${event.price}`;
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as JobAssignedEvent;
      return [e.cleanerId];
    },
  },
  {
    event: "job_accepted",
    role: "cleaner",
    title: () => "Job No Longer Available",
    message: (e: NotificationEvent) => {
      const event = e as JobAcceptedEvent;
      return `${event.cleanerName} accepted the job at ${event.propertyName}`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as JobAcceptedEvent;
      return users
        .filter((u) => u.role === "cleaner" && u.businessId === e.businessId && u.id !== e.cleanerId)
        .map((u) => u.id);
    },
  },
  {
    event: "job_cancelled",
    role: "cleaner",
    title: () => "Job Cancelled",
    message: (e: NotificationEvent) => {
      const event = e as JobCancelledEvent;
      return `Job at ${event.propertyName} has been cancelled${event.reason ? `: ${event.reason}` : ""}`;
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as JobCancelledEvent;
      return e.cleanerId ? [e.cleanerId] : [];
    },
  },
  {
    event: "job_reassigned",
    role: "cleaner",
    title: () => "Job Reassigned",
    message: (e: NotificationEvent) => {
      const event = e as JobReassignedEvent;
      return `Job at ${event.propertyName} has been reassigned to ${event.newCleanerName}`;
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as JobReassignedEvent;
      return [e.previousCleanerId, e.newCleanerId];
    },
  },
  {
    event: "booking_date_changed",
    role: "cleaner",
    title: () => "Booking Date Updated",
    message: (e: NotificationEvent) => {
      const event = e as BookingDateChangedEvent;
      return `${event.propertyName} checkout moved to ${event.newCheckoutDate.toLocaleDateString()}`;
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as BookingDateChangedEvent;
      return e.cleanerId ? [e.cleanerId] : [];
    },
  },
  {
    event: "message_received",
    role: "cleaner",
    title: () => "New Message",
    message: (e: NotificationEvent) => {
      const event = e as MessageReceivedEvent;
      return event.message.substring(0, 100);
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as MessageReceivedEvent;
      return [e.recipientId];
    },
  },
  {
    event: "invoice_period_ready",
    role: "cleaner",
    title: () => "Invoice Ready for Submission",
    message: (e: NotificationEvent) => {
      const event = e as InvoicePeriodReadyEvent;
      return `$${event.totalAmount} for ${event.jobCount} jobs (${event.periodStart.toLocaleDateString()} - ${event.periodEnd.toLocaleDateString()})`;
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as InvoicePeriodReadyEvent;
      return [e.cleanerId];
    },
  },

  // ========== MANAGER NOTIFICATIONS ==========
  {
    event: "job_accepted",
    role: "manager",
    title: () => "Job Accepted",
    message: (e: NotificationEvent) => {
      const event = e as JobAcceptedEvent;
      return `${event.cleanerName} accepted job at ${event.propertyName}`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as JobAcceptedEvent;
      // Find manager assigned to this job
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "job_started",
    role: "manager",
    title: () => "Job Started",
    message: (e: NotificationEvent) => {
      const event = e as JobStartedEvent;
      return `${event.cleanerName} started at ${event.propertyName} at ${event.startedAt.toLocaleTimeString()}`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as JobStartedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "job_completed",
    role: "manager",
    title: () => "Job Completed",
    message: (e: NotificationEvent) => {
      const event = e as JobCompletedEvent;
      return `${event.cleanerName} completed job at ${event.propertyName}. ${event.photoCount} photos, ${event.damageCount} damage reports.`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as JobCompletedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "damage_reported",
    role: "manager",
    title: () => "⚠️ DAMAGE REPORTED",
    message: (e: NotificationEvent) => {
      const event = e as DamageReportedEvent;
      return `${event.cleanerName} reported ${event.severity} damage at ${event.propertyName}: ${event.description}`;
    },
    isCritical: true, // Bypass quiet hours
    recipientIds: (event, users) => {
      const e = event as DamageReportedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "cleaner_removed",
    role: "manager",
    title: () => "⚠️ CLEANER REMOVED",
    message: (e: NotificationEvent) => {
      const event = e as CleanerRemovedEvent;
      return `${event.cleanerName} removed from ${event.propertyName} (${event.reason})`;
    },
    isCritical: true, // Bypass quiet hours
    recipientIds: (event, users) => {
      const e = event as CleanerRemovedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "cleaner_override_request",
    role: "manager",
    title: () => "⚠️ OVERRIDE REQUEST",
    message: (e: NotificationEvent) => {
      const event = e as CleanerOverrideRequestEvent;
      return `${event.cleanerName} requests override at ${event.propertyName}: ${event.reason}`;
    },
    isCritical: true, // Bypass quiet hours
    recipientIds: (event, users) => {
      const e = event as CleanerOverrideRequestEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "gps_mismatch",
    role: "manager",
    title: () => "⚠️ GPS MISMATCH",
    message: (e: NotificationEvent) => {
      const event = e as GPSMismatchEvent;
      return `${event.cleanerName} is ${event.distanceMeters}m away from ${event.propertyName}`;
    },
    isCritical: true, // Bypass quiet hours
    recipientIds: (event, users) => {
      const e = event as GPSMismatchEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "booking_date_changed",
    role: "manager",
    title: () => "Booking Date Updated",
    message: (e: NotificationEvent) => {
      const event = e as BookingDateChangedEvent;
      return `${event.propertyName} checkout moved from ${event.oldCheckoutDate.toLocaleDateString()} to ${event.newCheckoutDate.toLocaleDateString()}`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as BookingDateChangedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "invoice_submitted",
    role: "manager",
    title: () => "Invoice Submitted",
    message: (e: NotificationEvent) => {
      const event = e as InvoiceSubmittedEvent;
      return `${event.cleanerName} submitted invoice for $${event.totalAmount} (${event.jobCount} jobs)`;
    },
    isCritical: false,
    recipientIds: (event, users) => {
      const e = event as InvoiceSubmittedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
  {
    event: "message_received",
    role: "manager",
    title: () => "New Message",
    message: (e: NotificationEvent) => {
      const event = e as MessageReceivedEvent;
      return event.message.substring(0, 100);
    },
    isCritical: false,
    recipientIds: (event) => {
      const e = event as MessageReceivedEvent;
      return [e.recipientId];
    },
  },
  {
    event: "access_denied",
    role: "manager",
    title: () => "⚠️ ACCESS DENIED",
    message: (e: NotificationEvent) => {
      const event = e as AccessDeniedEvent;
      return `${event.cleanerName} could not access ${event.propertyName} (guest present)`;
    },
    isCritical: true, // Bypass quiet hours
    recipientIds: (event, users) => {
      const e = event as AccessDeniedEvent;
      return users
        .filter((u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === e.businessId)
        .map((u) => u.id);
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get notification rules for an event
 */
export function getNotificationRulesForEvent(event: NotificationEvent): NotificationRule[] {
  return NOTIFICATION_RULES.filter((rule) => rule.event === event.type);
}

/**
 * Check if event is critical (should bypass quiet hours)
 */
export function isCriticalEvent(event: NotificationEvent): boolean {
  const rules = getNotificationRulesForEvent(event);
  return rules.some((rule) => rule.isCritical);
}

/**
 * Get recipient IDs for an event
 */
export function getRecipientsForEvent(event: NotificationEvent, businessUsers: User[]): string[] {
  const rules = getNotificationRulesForEvent(event);
  const recipients = new Set<string>();

  for (const rule of rules) {
    const ids = rule.recipientIds(event, businessUsers);
    ids.forEach((id) => recipients.add(id));
  }

  return Array.from(recipients);
}
