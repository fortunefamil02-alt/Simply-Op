# Event-Driven Notification System

## Overview

Simply Organized uses a **strict event-driven architecture** for notifications. All notifications are triggered by system events, not UI actions. This ensures:

- **Consistency**: Same event always produces same notification
- **Auditability**: Every notification is logged and traceable
- **Offline Support**: Events queue when offline, fire on reconnect
- **Role-Based Delivery**: Notifications respect role permissions
- **Critical Alerts**: High-priority events bypass quiet hours

## Architecture

### Three Delivery Channels

1. **Push Notifications** (Primary)
   - Delivered to device via Firebase Cloud Messaging (FCM) or Apple Push Notification (APNs)
   - Sound: "default" for normal, "critical" for high-priority
   - Priority: "high" for critical, "normal" for routine

2. **In-App Notifications** (Persistent & Auditable)
   - Stored in database indefinitely
   - Marked as read/unread by user
   - Queryable for audit trails
   - Accessible in app notification center

3. **Offline Queue** (No Data Loss)
   - Events queue when device is offline
   - Automatic retry (max 3 attempts) when connectivity resumes
   - Failed items logged for manual review

## Event Types

### Job Lifecycle Events

| Event | Triggered By | Recipients | Critical |
|-------|--------------|------------|----------|
| `job_available` | Job created | All cleaners | No |
| `job_assigned` | Manager assigns job | Assigned cleaner | No |
| `job_accepted` | Cleaner accepts job | Other cleaners, manager | No |
| `job_started` | First photo uploaded | Manager | No |
| `job_completed` | Cleaner marks done | Manager | No |
| `job_cancelled` | Manager cancels | Assigned cleaner | No |
| `job_reassigned` | Job reassigned | Previous & new cleaner, manager | No |

### Critical Alerts (Bypass Quiet Hours)

| Event | Triggered By | Recipients | Priority |
|-------|--------------|------------|----------|
| `damage_reported` | Cleaner reports damage | Manager | HIGH |
| `cleaner_removed` | Cleaner can't access property | Manager | HIGH |
| `cleaner_override_request` | Cleaner requests help | Manager | HIGH |
| `gps_mismatch` | GPS location doesn't match | Manager | HIGH |
| `access_denied` | Guest present at property | Manager | HIGH |

### Booking & Invoice Events

| Event | Triggered By | Recipients | Critical |
|-------|--------------|------------|----------|
| `booking_date_changed` | Booking extended | Assigned cleaner, manager | No |
| `invoice_submitted` | Cleaner submits invoice | Manager | No |
| `invoice_period_ready` | Invoice period complete | Cleaner | No |

### Chat Events

| Event | Triggered By | Recipients | Critical |
|-------|--------------|------------|----------|
| `message_received` | Message sent in job chat | Other participant | No |
| `chat_locked` | Job completed | Both participants | No |

## Role-Based Delivery Rules

### Cleaners Receive

- ✅ New job available
- ✅ Job assigned directly
- ✅ Job accepted by another cleaner
- ✅ Booking date changes
- ✅ Job cancelled or reassigned
- ✅ Manager messages (job-scoped)
- ✅ Invoice period ready
- ❌ Damage reports
- ❌ Other cleaner's job events
- ❌ Override requests
- ❌ Booking changes (other properties)

### Managers Receive

- ✅ Job accepted
- ✅ Job started
- ✅ Job completed
- ✅ Damage reported (CRITICAL)
- ✅ Cleaner removed (CRITICAL)
- ✅ Override requests (CRITICAL)
- ✅ GPS mismatch (CRITICAL)
- ✅ Access denied (CRITICAL)
- ✅ Booking date changes
- ✅ Invoice submitted
- ✅ Cleaner messages (job-scoped)
- ❌ Job available
- ❌ Job accepted by other cleaners

### Super Managers

- ✅ All manager notifications
- ✅ Can contact guests externally (outside app)

## Event Flow Examples

### Job Acceptance Flow

```
1. Cleaner taps "Accept Job"
   ↓
2. System updates job.status = "accepted"
   ↓
3. System emits JobAcceptedEvent
   ↓
4. Notification system determines recipients:
   - Manager (assigned to job)
   - Other cleaners (job no longer available)
   ↓
5. Push notifications sent to each recipient
   ↓
6. In-app notifications saved to database
   ↓
7. Chat thread created for cleaner ↔ manager
```

### Damage Report Flow (CRITICAL)

```
1. Cleaner uploads damage photo + description
   ↓
2. System creates DamageReport record
   ↓
3. System emits DamageReportedEvent (CRITICAL)
   ↓
4. Notification system:
   - Marks as critical (bypass quiet hours)
   - Sends high-priority push notification
   - Saves in-app notification
   - Logs audit trail
   ↓
5. Manager receives alert immediately
   ↓
6. Manager can view damage photos in app
```

### Offline Job Completion Flow

```
1. Cleaner completes job while offline
   ↓
2. System marks job.status = "completed"
   ↓
3. System queues JobCompletedEvent (offline)
   ↓
4. When connectivity resumes:
   ↓
5. System retries queued event
   ↓
6. Manager receives notification
   ↓
7. Job added to rolling invoice
```

## Notification Data Model

Each notification stores:

```typescript
{
  notificationId: string;        // Unique ID
  userId: string;                // Recipient
  role: "super_manager" | "manager" | "cleaner";  // Role at time of notification
  type: NotificationEvent["type"];  // Event type
  jobId?: string;                // Associated job (if applicable)
  title: string;                 // Push notification title
  message: string;               // Push notification body
  isCritical: boolean;           // Bypass quiet hours if true
  isRead: boolean;               // User has read in app
  createdAt: Date;               // When notification was created
}
```

## Job-Scoped Chat

### Rules

- **One thread per job** — No cross-job chat
- **Cleaner ↔ Manager only** — No other participants
- **Locked on completion** — Can't send messages after job done
- **Message notifications** — Each message triggers push notification
- **Persistent** — All messages stored for audit trail

### Chat Lifecycle

```
1. Job created
   ↓
2. Chat thread created (empty)
   ↓
3. Cleaner and manager exchange messages
   ↓
4. Each message triggers notification to other participant
   ↓
5. Job completed
   ↓
6. Chat locked (no new messages allowed)
   ↓
7. Messages remain viewable for audit
```

## Critical Alerts (High Priority)

These events **bypass quiet hours** and use **critical sound**:

1. **Damage Reported** — Property damage discovered
2. **Cleaner Removed** — Cleaner can't access property
3. **Override Request** — Cleaner requests manager help
4. **GPS Mismatch** — Cleaner location doesn't match property
5. **Access Denied** — Guest present at property

### Why Critical?

- Require immediate manager action
- May affect payment or rescheduling
- Could indicate security/safety issues
- Time-sensitive resolution needed

## Offline Support

### Queuing

When device goes offline:
1. Events are queued locally
2. Retry counter initialized to 0
3. Queue persisted to device storage

### Processing

When device comes online:
1. System detects connectivity
2. Processes queued events in order
3. Retries failed events (max 3 attempts)
4. Removes successful items from queue
5. Logs failed items for manual review

### No Data Loss

- Queue survives app restart
- Events never discarded (only after max retries)
- Audit trail maintained for all attempts

## Implementation

### Event Emission

```typescript
import { emitJobCompleted } from "@/server/notifications/job-events";

// When job is marked complete:
await emitJobCompleted(
  job,
  cleaner,
  property,
  photoCount,
  damageCount,
  businessUsers
);
```

### Sending Chat Messages

```typescript
import { sendJobChatMessage } from "@/server/notifications/job-chat";

// When cleaner sends message:
await sendJobChatMessage(
  jobId,
  senderId,
  "Message text",
  job,
  businessUsers
);
// Automatically triggers MessageReceivedEvent
```

### Handling Connectivity

```typescript
import { handleConnectivityChange } from "@/server/notifications/delivery";

// When device comes online:
handleConnectivityChange(true);
// Automatically processes offline queue

// When device goes offline:
handleConnectivityChange(false);
// Queues future events
```

## Database Schema

### Notifications Table

```sql
CREATE TABLE notifications (
  id VARCHAR(64) PRIMARY KEY,
  business_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_job_id VARCHAR(64),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (business_id),
  INDEX (user_id),
  INDEX (related_job_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (related_job_id) REFERENCES cleaning_jobs(id)
);
```

### Job Chat Table

```sql
CREATE TABLE job_chat (
  id VARCHAR(64) PRIMARY KEY,
  job_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (job_id),
  INDEX (sender_id),
  FOREIGN KEY (job_id) REFERENCES cleaning_jobs(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
```

## Testing

### Simulate Events

```typescript
import { emitJobAvailable } from "@/server/notifications/job-events";

// Test job available notification
await emitJobAvailable(mockJob, mockProperty, mockUsers);
```

### Simulate Offline

```typescript
import { handleConnectivityChange } from "@/server/notifications/delivery";

// Simulate going offline
handleConnectivityChange(false);

// Emit event (will queue)
await emitJobCompleted(...);

// Simulate coming online
handleConnectivityChange(true);
// Event automatically retried
```

## Monitoring

### Queue Status

```typescript
import { getNotificationDeliveryService } from "@/server/notifications/delivery";

const service = getNotificationDeliveryService();
const status = service.getQueueStatus();
console.log(`Queued events: ${status.size}`);
console.log(`Oldest: ${status.oldestItem}`);
```

### Audit Trail

Query notifications table:

```sql
SELECT * FROM notifications
WHERE user_id = ?
ORDER BY created_at DESC;
```

Query job chat:

```sql
SELECT * FROM job_chat
WHERE job_id = ?
ORDER BY created_at ASC;
```

## Best Practices

1. **Always emit events** — Don't send notifications directly
2. **Include context** — Pass full user/job/property objects
3. **Handle offline** — Assume connectivity may drop
4. **Test critical paths** — Verify damage/override alerts work
5. **Monitor queue** — Check for stuck/failed events
6. **Audit regularly** — Review notification logs for issues

## Future Enhancements

- [ ] SMS notifications for critical alerts
- [ ] Email digest for daily summary
- [ ] Notification preferences per user
- [ ] Quiet hours configuration
- [ ] Notification templates (i18n)
- [ ] Analytics dashboard
- [ ] Webhook delivery for integrations
