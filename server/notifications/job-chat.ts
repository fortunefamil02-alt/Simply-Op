/**
 * Job-Scoped Chat System
 *
 * - One chat thread per job
 * - Cleaner ↔ Manager only
 * - No cross-job chat
 * - Messages trigger push notifications
 * - Chat locked when job completed
 */

import type { JobChat, CleaningJob, User } from "@/drizzle/schema";
import { emitNotificationEvent } from "./delivery";
import type { MessageReceivedEvent } from "./events";

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ChatThread {
  jobId: string;
  cleanerId: string;
  managerId: string;
  isLocked: boolean;
  messages: ChatMessage[];
  createdAt: Date;
  lockedAt?: Date;
}

// ============================================================================
// JOB CHAT SERVICE
// ============================================================================

export class JobChatService {
  /**
   * Send message in job chat
   * Only cleaner and assigned manager can participate
   */
  async sendMessage(
    jobId: string,
    senderId: string,
    message: string,
    job: CleaningJob,
    businessUsers: User[]
  ): Promise<ChatMessage> {
    // Validate sender is either cleaner or manager
    const sender = businessUsers.find((u) => u.id === senderId);
    if (!sender) {
      throw new Error("Sender not found");
    }

    if (sender.role === "cleaner" && sender.id !== job.assignedCleanerId) {
      throw new Error("Cleaner can only message their own jobs");
    }

    if (sender.role !== "cleaner" && sender.role !== "manager" && sender.role !== "super_manager") {
      throw new Error("Invalid role for chat");
    }

    // Check if chat is locked (job completed)
    if (job.status === "completed" || job.status === "needs_review") {
      throw new Error("Chat is locked for completed jobs");
    }

    // Create message
    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jobId,
      senderId,
      message,
      isRead: false,
      createdAt: new Date(),
    };

    // TODO: Save to database
    // await db.insert(jobChat).values({
    //   id: chatMessage.id,
    //   jobId,
    //   senderId,
    //   message,
    //   isRead: false,
    //   createdAt: chatMessage.createdAt,
    // });

    // Determine recipient
    const recipientId =
      sender.role === "cleaner" ? this.getManagerForJob(job, businessUsers) : job.assignedCleanerId;

    if (!recipientId) {
      throw new Error("Could not determine message recipient");
    }

    // Emit notification event
    const event: MessageReceivedEvent = {
      type: "message_received",
      messageId: chatMessage.id,
      jobId,
      businessId: job.businessId,
      senderId,
      senderName: `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email,
      senderRole: sender.role === "cleaner" ? "cleaner" : "manager",
      recipientId,
      message,
      timestamp: new Date(),
    };

    await emitNotificationEvent(event, businessUsers);

    console.log(`[Chat] Message sent in job ${jobId} from ${senderId} to ${recipientId}`);

    return chatMessage;
  }

  /**
   * Get chat thread for a job
   */
  async getChatThread(jobId: string, job: CleaningJob, businessUsers: User[]): Promise<ChatThread> {
    // TODO: Fetch from database
    // const messages = await db.query.jobChat.findMany({
    //   where: eq(jobChat.jobId, jobId),
    //   orderBy: asc(jobChat.createdAt),
    // });

    const managerId = this.getManagerForJob(job, businessUsers);

    return {
      jobId,
      cleanerId: job.assignedCleanerId || "",
      managerId: managerId || "",
      isLocked: job.status === "completed" || job.status === "needs_review",
      messages: [], // TODO: Map from database
      createdAt: job.createdAt,
      lockedAt:
        job.status === "completed" || job.status === "needs_review" ? job.completedAt || undefined : undefined,
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(jobId: string, userId: string): Promise<void> {
    // TODO: Update database
    // await db.update(jobChat)
    //   .set({ isRead: true })
    //   .where(and(
    //     eq(jobChat.jobId, jobId),
    //     ne(jobChat.senderId, userId)
    //   ));

    console.log(`[Chat] Marked messages as read for ${userId} in job ${jobId}`);
  }

  /**
   * Lock chat when job is completed
   */
  async lockChatForJob(jobId: string, job: CleaningJob, businessUsers: User[]): Promise<void> {
    const managerId = this.getManagerForJob(job, businessUsers);

    // TODO: Update database to mark chat as locked
    // (This is implicit in the job status, but could add explicit lock flag)

    console.log(`[Chat] Chat locked for job ${jobId}`);

    // Notify both participants
    const cleaner = businessUsers.find((u) => u.id === job.assignedCleanerId);
    const manager = businessUsers.find((u) => u.id === managerId);

    if (cleaner && manager) {
      // TODO: Emit notification event
      console.log(`[Chat] Notified ${cleaner.email} and ${manager.email} that chat is locked`);
    }
  }

  /**
   * Get unread message count for user in a job
   */
  async getUnreadCount(jobId: string, userId: string): Promise<number> {
    // TODO: Query database
    // const count = await db.query.jobChat.findMany({
    //   where: and(
    //     eq(jobChat.jobId, jobId),
    //     ne(jobChat.senderId, userId),
    //     eq(jobChat.isRead, false)
    //   ),
    // });
    // return count.length;

    return 0;
  }

  /**
   * Get manager for a job
   */
  private getManagerForJob(job: CleaningJob, businessUsers: User[]): string | undefined {
    // TODO: Get the manager who assigned this job
    // For now, return first manager in business
    const manager = businessUsers.find(
      (u) => (u.role === "manager" || u.role === "super_manager") && u.businessId === job.businessId
    );
    return manager?.id;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let chatService: JobChatService | null = null;

export function getJobChatService(): JobChatService {
  if (!chatService) {
    chatService = new JobChatService();
  }
  return chatService;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send message in job chat
 */
export async function sendJobChatMessage(
  jobId: string,
  senderId: string,
  message: string,
  job: CleaningJob,
  businessUsers: User[]
): Promise<ChatMessage> {
  const service = getJobChatService();
  return service.sendMessage(jobId, senderId, message, job, businessUsers);
}

/**
 * Get chat thread for job
 */
export async function getJobChatThread(
  jobId: string,
  job: CleaningJob,
  businessUsers: User[]
): Promise<ChatThread> {
  const service = getJobChatService();
  return service.getChatThread(jobId, job, businessUsers);
}

/**
 * Lock chat when job completes
 */
export async function lockJobChat(
  jobId: string,
  job: CleaningJob,
  businessUsers: User[]
): Promise<void> {
  const service = getJobChatService();
  return service.lockChatForJob(jobId, job, businessUsers);
}
