/**
 * Notification Delivery Engine
 *
 * Handles multi-channel delivery:
 * - Push notifications (primary)
 * - In-app notifications (persistent, auditable)
 * - Offline queuing (sync on reconnect)
 */

import type { NotificationEvent } from "./events";
import { getRecipientsForEvent, isCriticalEvent, getNotificationRulesForEvent } from "./events";
import type { User } from "@/drizzle/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationPayload {
  notificationId: string;
  userId: string;
  role: "super_manager" | "manager" | "cleaner";
  type: NotificationEvent["type"];
  jobId?: string;
  title: string;
  message: string;
  isCritical: boolean;
  isRead: boolean;
  createdAt: Date;
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  badge?: number;
  sound?: string; // "default", "critical", "silent"
  priority?: "high" | "normal";
  data?: Record<string, string>;
}

export interface OfflineQueueItem {
  id: string;
  event: NotificationEvent;
  businessUsers: User[];
  queuedAt: Date;
  retryCount: number;
}

// ============================================================================
// NOTIFICATION DELIVERY SERVICE
// ============================================================================

export class NotificationDeliveryService {
  private offlineQueue: Map<string, OfflineQueueItem> = new Map();
  private isOnline: boolean = true;

  /**
   * Deliver notification for an event
   */
  async deliverNotification(event: NotificationEvent, businessUsers: User[]): Promise<void> {
    if (!this.isOnline) {
      this.queueOfflineEvent(event, businessUsers);
      return;
    }

    try {
      const recipientIds = getRecipientsForEvent(event, businessUsers);
      const rules = getNotificationRulesForEvent(event);

      for (const rule of rules) {
        for (const recipientId of recipientIds) {
          const recipient = businessUsers.find((u) => u.id === recipientId);
          if (!recipient) continue;

          const payload: NotificationPayload = {
            notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: recipientId,
            role: recipient.role as "super_manager" | "manager" | "cleaner",
            type: event.type,
            jobId: (event as any).jobId,
            title: rule.title(event),
            message: rule.message(event),
            isCritical: rule.isCritical,
            isRead: false,
            createdAt: new Date(),
          };

          // Deliver via multiple channels
          await Promise.all([
            this.sendPushNotification(recipient, payload, rule.isCritical),
            this.saveInAppNotification(payload),
            this.logNotificationEvent(payload, event),
          ]);
        }
      }
    } catch (error) {
      console.error("[Notifications] Delivery failed:", error);
      this.queueOfflineEvent(event, businessUsers);
    }
  }

  /**
   * Send push notification (primary channel)
   */
  private async sendPushNotification(
    user: User,
    payload: NotificationPayload,
    isCritical: boolean
  ): Promise<void> {
    try {
      const pushPayload: PushNotificationPayload = {
        title: payload.title,
        message: payload.message,
        badge: 1,
        sound: isCritical ? "critical" : "default",
        priority: isCritical ? "high" : "normal",
        data: {
          notificationId: payload.notificationId,
          jobId: payload.jobId || "",
          type: payload.type,
        },
      };

      // TODO: Integrate with push notification service (Firebase Cloud Messaging, APNs, etc.)
      // For now, log the push notification
      console.log(`[Push] To ${user.email}: ${payload.title}`);

      // Simulate push delivery
      await this.simulatePushDelivery(user.id, pushPayload);
    } catch (error) {
      console.error(`[Push] Failed to send to ${user.email}:`, error);
      throw error;
    }
  }

  /**
   * Save in-app notification (persistent, auditable)
   */
  private async saveInAppNotification(payload: NotificationPayload): Promise<void> {
    try {
      // TODO: Save to database
      // await db.insert(notifications).values({
      //   id: payload.notificationId,
      //   userId: payload.userId,
      //   type: payload.type,
      //   title: payload.title,
      //   message: payload.message,
      //   isCritical: payload.isCritical,
      //   isRead: false,
      //   createdAt: payload.createdAt,
      // });

      console.log(`[InApp] Saved notification ${payload.notificationId} for ${payload.userId}`);
    } catch (error) {
      console.error("[InApp] Failed to save notification:", error);
      throw error;
    }
  }

  /**
   * Log notification event for audit trail
   */
  private async logNotificationEvent(
    payload: NotificationPayload,
    event: NotificationEvent
  ): Promise<void> {
    try {
      // TODO: Save to audit log
      console.log(
        `[Audit] Notification ${payload.notificationId} for event ${event.type} to ${payload.userId}`
      );
    } catch (error) {
      console.error("[Audit] Failed to log notification:", error);
    }
  }

  /**
   * Queue event for offline delivery
   */
  private queueOfflineEvent(event: NotificationEvent, businessUsers: User[]): void {
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: OfflineQueueItem = {
      id: queueId,
      event,
      businessUsers,
      queuedAt: new Date(),
      retryCount: 0,
    };

    this.offlineQueue.set(queueId, item);
    console.log(`[Offline] Queued event ${event.type} (queue size: ${this.offlineQueue.size})`);
  }

  /**
   * Process offline queue when connectivity resumes
   */
  async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.size === 0) {
      console.log("[Offline] Queue is empty");
      return;
    }

    console.log(`[Offline] Processing ${this.offlineQueue.size} queued events...`);

    const failedItems: string[] = [];

    for (const [queueId, item] of this.offlineQueue) {
      try {
        await this.deliverNotification(item.event, item.businessUsers);
        this.offlineQueue.delete(queueId);
        console.log(`[Offline] Delivered queued event ${item.event.type}`);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= 3) {
          console.error(`[Offline] Max retries exceeded for ${queueId}:`, error);
          failedItems.push(queueId);
        } else {
          console.warn(`[Offline] Retry ${item.retryCount}/3 for ${queueId}:`, error);
        }
      }
    }

    // Remove failed items after max retries
    failedItems.forEach((id) => this.offlineQueue.delete(id));

    if (this.offlineQueue.size === 0) {
      console.log("[Offline] Queue processed successfully");
    } else {
      console.warn(`[Offline] ${this.offlineQueue.size} items still in queue`);
    }
  }

  /**
   * Set online/offline status
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (!wasOnline && isOnline) {
      console.log("[Connectivity] Back online, processing queue...");
      this.processOfflineQueue().catch((error) => {
        console.error("[Connectivity] Failed to process queue:", error);
      });
    } else if (wasOnline && !isOnline) {
      console.log("[Connectivity] Offline, queuing notifications");
    }
  }

  /**
   * Get offline queue status
   */
  getQueueStatus(): { size: number; oldestItem?: Date } {
    if (this.offlineQueue.size === 0) {
      return { size: 0 };
    }

    let oldestDate: Date | undefined;
    for (const item of this.offlineQueue.values()) {
      if (!oldestDate || item.queuedAt < oldestDate) {
        oldestDate = item.queuedAt;
      }
    }

    return { size: this.offlineQueue.size, oldestItem: oldestDate };
  }

  /**
   * Simulate push delivery (for testing)
   */
  private async simulatePushDelivery(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[Push] Delivered to ${userId}: ${payload.title}`);
        resolve();
      }, 100);
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let deliveryService: NotificationDeliveryService | null = null;

export function getNotificationDeliveryService(): NotificationDeliveryService {
  if (!deliveryService) {
    deliveryService = new NotificationDeliveryService();
  }
  return deliveryService;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Emit notification event
 */
export async function emitNotificationEvent(
  event: NotificationEvent,
  businessUsers: User[]
): Promise<void> {
  const service = getNotificationDeliveryService();
  await service.deliverNotification(event, businessUsers);
}

/**
 * Handle connectivity change
 */
export function handleConnectivityChange(isOnline: boolean): void {
  const service = getNotificationDeliveryService();
  service.setOnlineStatus(isOnline);
}
