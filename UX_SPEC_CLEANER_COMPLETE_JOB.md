# UX Specification: Cleaner → Complete Job Flow

## Overview
This document describes the complete user experience for a cleaner completing a job, including both the success path and the needs_review path (when conflicts are detected).

---

## PART 1: SUCCESS PATH (No Conflicts)

### Screen 1: Job Detail (In Progress State)

**What Cleaner Sees:**
- Property name and address (top section)
- Guest count + pets indicator
- Cleaning date
- Price (read-only)
- **Status badge: "In Progress" (orange/warning color)**
- **Elapsed time timer** (HH:MM:SS format, updates every second)
- GPS status indicator: "Checking..." or "✓ Location verified" (green)
- Instructions (if any)
- **Single action button: "Mark Done" (green/success color)**

**Available Actions:**
- Tap "Mark Done" button to complete the job

**Error/Blocked States:**
- "Mark Done" button is disabled (grayed out) if:
  - No photos uploaded (will be checked server-side)
  - GPS is not verified (will be checked server-side)
  - Network is offline (queued for sync)

**Copy/Messages:**
- Timer label: "Elapsed Time"
- GPS label: "GPS Status"
- GPS status text: "✓ Location verified" (green) or "Checking location..." (gray)
- Button text: "Mark Done"

---

### Screen 2: Completion Confirmation (Success Path)

**Trigger:** Cleaner taps "Mark Done" button

**What Happens:**
1. App shows loading spinner with text: "Verifying location and photos..."
2. Server validates:
   - GPS coordinates are within 50m of property ✓
   - At least 1 photo exists ✓
   - Job status is "in_progress" ✓
3. Server atomically updates job status to "completed"
4. Server adds job to rolling invoice (append-only)
5. App receives success response

**What Cleaner Sees:**
- Loading spinner with message: "Verifying location and photos..."
- (Spinner disappears after 2-3 seconds)
- **Alert dialog appears:**
  - Title: "✓ Job Completed"
  - Message: "Excellent work! Your job has been completed and added to your invoice."
  - Button: "OK"
  - Job status badge changes to "Completed" (green)

**Available Actions:**
- Tap "OK" button to dismiss alert and return to job list

**Copy/Messages:**
- Loading message: "Verifying location and photos..."
- Alert title: "✓ Job Completed"
- Alert message: "Excellent work! Your job has been completed and added to your invoice."
- Button text: "OK"

---

### Screen 3: Back to Job List

**What Cleaner Sees:**
- Job list screen
- Job card now shows status: "Completed" (green badge)
- Job is moved to "Completed" tab (if using tabs)
- Job card is grayed out or marked as completed
- Next available job is highlighted

**Available Actions:**
- Accept another job
- View completed job details
- Navigate to invoice screen

---

## PART 2: NEEDS_REVIEW PATH (Conflicts Detected)

### Screen 1: Job Detail (In Progress State)

**Same as Success Path Screen 1**
- Property name, address, guest count, pets, date, price
- Status badge: "In Progress"
- Elapsed time timer
- GPS status indicator
- Instructions
- "Mark Done" button

---

### Screen 2: Completion Attempt with Conflicts

**Trigger:** Cleaner taps "Mark Done" button

**What Happens:**
1. App shows loading spinner: "Verifying location and photos..."
2. Server validates:
   - GPS coordinates: **FAIL** (cleaner is 150m away from property)
   - Photos: **FAIL** (0 photos uploaded)
3. Server detects conflicts but does NOT reject the completion
4. Server atomically updates job status to "needs_review"
5. Server flags conflicts: GPS_INVALID, MISSING_PHOTOS
6. Server adds job to rolling invoice (append-only, even with conflicts)
7. App receives response with conflict details

**What Cleaner Sees:**
- Loading spinner disappears
- **Alert dialog appears:**
  - Title: "⚠️ Review Required"
  - Message: "Your job has some issues that need manager review. A manager will contact you shortly to resolve them."
  - Button: "OK"
  - Job status badge changes to "Needs Review" (red/error color)

**Available Actions:**
- Tap "OK" button to dismiss alert and return to job list

**Copy/Messages:**
- Loading message: "Verifying location and photos..."
- Alert title: "⚠️ Review Required"
- Alert message: "Your job has some issues that need manager review. A manager will contact you shortly to resolve them."
- Button text: "OK"

---

### Screen 3: Job Detail After Completion (Needs Review)

**What Cleaner Sees:**
- Property name, address, guest count, pets, date, price
- **Status badge: "Needs Review" (red/error color)**
- Elapsed time timer (frozen at final time)
- GPS status indicator: "✗ Location invalid" (red)
- **Conflict warning section** (red/error background):
  - Title: "⚠️ Review Required"
  - List of conflicts:
    - "GPS location invalid"
      - Details: "You are 150m away from the property. Get closer to complete."
    - "No photos uploaded"
      - Details: "Upload at least 1 photo before completing the job"
- Instructions
- **Action button: "View Invoice" (blue/primary color)**
  - (Job is still added to invoice, but marked as needs_review)

**Available Actions:**
- Tap "View Invoice" to see the job on the invoice
- Tap back arrow to return to job list
- Wait for manager to contact about conflicts

**Error/Blocked States:**
- "Mark Done" button is hidden (job already attempted completion)
- Cleaner cannot retry completion (must wait for manager override)
- Cleaner can still view invoice and submit it

**Copy/Messages:**
- Status label: "Needs Review"
- Conflict section title: "⚠️ Review Required"
- Conflict 1 title: "GPS location invalid"
- Conflict 1 details: "You are 150m away from the property. Get closer to complete."
- Conflict 2 title: "No photos uploaded"
- Conflict 2 details: "Upload at least 1 photo before completing the job"
- Button text: "View Invoice"

---

### Screen 4: Back to Job List

**What Cleaner Sees:**
- Job list screen
- Job card now shows status: "Needs Review" (red badge)
- Job is moved to "Needs Review" tab (if using tabs)
- Job card is highlighted in red or marked as requiring attention
- Notification badge appears on job card (e.g., "⚠️ 1 issue")

**Available Actions:**
- Accept another job
- View needs_review job details
- Navigate to invoice screen
- Wait for manager to contact about conflicts

---

## PART 3: OFFLINE BEHAVIOR

### Scenario: Cleaner Completes Job While Offline

**What Happens:**
1. Cleaner taps "Mark Done"
2. App attempts to validate GPS locally (client-side)
3. GPS validation passes (cleaner is at property)
4. App attempts to send completion to server
5. **Network error detected** (no internet)
6. App queues the completion request locally

**What Cleaner Sees:**
- Loading spinner: "Verifying location and photos..."
- (Spinner continues for 3-5 seconds)
- **Alert dialog:**
  - Title: "Offline"
  - Message: "You're offline. Your job completion has been saved and will sync when you reconnect."
  - Button: "OK"
- Job status badge changes to "Completed" (local state)
- Offline indicator appears at top of screen (e.g., "⚠️ Offline - syncing when online")

**Available Actions:**
- Tap "OK" to dismiss alert
- Continue working offline
- When internet reconnects, completion automatically syncs

**Copy/Messages:**
- Loading message: "Verifying location and photos..."
- Alert title: "Offline"
- Alert message: "You're offline. Your job completion has been saved and will sync when you reconnect."
- Offline indicator: "⚠️ Offline - syncing when online"

---

## PART 4: SPECIFIC CONFLICT SCENARIOS

### Conflict 1: GPS Too Far

**Trigger:** Cleaner is >50m from property when tapping "Mark Done"

**What Cleaner Sees:**
- Loading spinner: "Verifying location and photos..."
- Alert: "⚠️ Review Required"
- Job status: "Needs Review"
- Conflict warning:
  - Title: "GPS location invalid"
  - Details: "You are [X]m away from the property. Get closer to complete."
    - Example: "You are 150m away from the property. Get closer to complete."
    - Example: "You are 75m away from the property. Get closer to complete."

**Copy/Messages:**
- Error message includes exact distance: "You are [DISTANCE]m away from the property."
- Actionable guidance: "Get closer to complete."

---

### Conflict 2: GPS Precision Too Low

**Trigger:** GPS accuracy is >50m (low precision)

**What Cleaner Sees:**
- Loading spinner: "Verifying location and photos..."
- Alert: "⚠️ Review Required"
- Job status: "Needs Review"
- Conflict warning:
  - Title: "GPS precision too low"
  - Details: "Your GPS accuracy is [X]m. Please try again in an open area."
    - Example: "Your GPS accuracy is 65m. Please try again in an open area."

**Copy/Messages:**
- Error message includes precision: "Your GPS accuracy is [PRECISION]m."
- Actionable guidance: "Please try again in an open area."

---

### Conflict 3: Missing Photos

**Trigger:** No photos have been uploaded for the job

**What Cleaner Sees:**
- Loading spinner: "Verifying location and photos..."
- Alert: "⚠️ Review Required"
- Job status: "Needs Review"
- Conflict warning:
  - Title: "No photos uploaded"
  - Details: "Upload at least 1 photo before completing the job"

**Copy/Messages:**
- Error message: "No photos uploaded"
- Actionable guidance: "Upload at least 1 photo before completing the job"

---

### Conflict 4: Access Denied (Guest Present)

**Trigger:** Cleaner marks job done but guest is still at property (booking not checked out)

**What Cleaner Sees:**
- Loading spinner: "Verifying location and photos..."
- Alert: "⚠️ Review Required"
- Job status: "Needs Review"
- Conflict warning:
  - Title: "Access denied"
  - Details: "Guest is still at the property. Cleaning cannot be completed until checkout."

**Copy/Messages:**
- Error message: "Access denied"
- Actionable guidance: "Guest is still at the property. Cleaning cannot be completed until checkout."

---

## PART 5: INVOICE INTEGRATION

### Behavior: Job Added to Invoice Regardless of Status

**Important:** Jobs are added to the rolling invoice **immediately upon completion**, whether the status is "completed" or "needs_review".

**What Cleaner Sees:**
- After job completion (success or needs_review), job appears on invoice
- Invoice shows all jobs (completed + needs_review)
- Cleaner can submit invoice anytime
- Manager can adjust pricing before invoice submission

**Copy/Messages:**
- Invoice section: "Jobs (X)" where X is the count of jobs
- Job line item: "[Property Name] - $[Price] - [Date]"
- Invoice total: "Total Amount: $[TOTAL]"

---

## SUMMARY TABLE

| Path | Status | Alert | Conflicts Shown | Invoice Added | Next Action |
|------|--------|-------|-----------------|----------------|-------------|
| Success | "Completed" | "✓ Job Completed" | None | Yes | View invoice or accept new job |
| GPS Fail | "Needs Review" | "⚠️ Review Required" | GPS distance/precision | Yes | Wait for manager or view invoice |
| Missing Photos | "Needs Review" | "⚠️ Review Required" | Missing photos | Yes | Wait for manager or view invoice |
| Access Denied | "Needs Review" | "⚠️ Review Required" | Guest present | Yes | Wait for manager or view invoice |
| Offline | "Completed" (local) | "Offline" | None (local) | Queued | Sync when online |

---

## PART 6: EXACT COPY MATRIX (LOCKED)

### Online Success Path

| Element | Copy |
|---------|------|
| Loading message | "Verifying location and photos..." |
| Success alert title | "✓ Job Completed" |
| Success alert message | "Excellent work! Your job has been completed and added to your invoice." |
| Success alert button | "OK" |
| Status badge | "Completed" (green) |

### Online Needs_Review Path

| Element | Copy |
|---------|------|
| Loading message | "Verifying location and photos..." |
| Needs_review alert title | "⚠️ Review Required" |
| Needs_review alert message | "Your job has some issues that need manager review. A manager will contact you shortly to resolve them." |
| Needs_review alert button | "OK" |
| Status badge | "Needs Review" (red) |
| Conflict section title | "⚠️ Review Required" |

### Offline Submission Success

| Element | Copy |
|---------|------|
| Loading message | "Verifying location and photos..." |
| Offline alert title | "Offline" |
| Offline alert message | "You're offline. Your job completion has been saved and will sync when you reconnect." |
| Offline alert button | "OK" |
| Status badge (local) | "Completed" (green) |
| Offline indicator | "⚠️ Offline - syncing when online" |

### Offline Submission Sync Failure (Reconnected but Server Rejects)

| Element | Copy |
|---------|------|
| Sync notification title | "Sync Failed" |
| Sync notification message | "Your job completion could not be synced. Please check your connection and try again." |
| Status badge (reverted) | "In Progress" (orange) |
| Retry button | "Retry" |

### Manager Later Approval (needs_review → completed)

**Trigger:** Manager overrides needs_review job to completed status

| Element | Copy |
|---------|------|
| Notification title | "Job Approved" |
| Notification message | "Your job has been approved by a manager. Status: Completed." |
| Status badge | "Completed" (green) |
| Job detail status | "Completed" |
| Conflict section | Hidden |
| Available actions | "View Invoice" |

### Manager Later Rejection (needs_review → available)

**Trigger:** Manager rejects needs_review job and reassigns to another cleaner or reopens

| Element | Copy |
|---------|------|
| Notification title | "Job Reassigned" |
| Notification message | "Your job has been reassigned. Reason: [Manager reason]. You will not be paid for this job." |
| Status badge | "Available" (green) |
| Job detail status | "Available" |
| Conflict section | Hidden |
| Available actions | None (job removed from cleaner's list) |
| Invoice impact | Job line item voided (marked as voided in invoice history) |

### Manager Later Rejection (needs_review → needs_review with override reason)

**Trigger:** Manager reviews conflict but keeps job in needs_review pending cleaner action

| Element | Copy |
|---------|------|
| Notification title | "Job Reviewed" |
| Notification message | "A manager has reviewed your job. Status: Still needs review. [Manager notes: GPS was 200m away. Please retry when closer to property.]" |
| Status badge | "Needs Review" (red) |
| Job detail status | "Needs Review" |
| Conflict section | Updated with manager notes |
| Available actions | "Retry Completion" (if applicable) |

---

## PART 7: CLEANER PERMISSIONS MATRIX (needs_review State)

For a job in "needs_review" status, the following permissions apply:

| Action | Allowed | Notes |
|--------|---------|-------|
| **Add photos** | YES | Cleaner can upload photos to resolve missing photo conflict |
| **Edit notes** | NO | Notes are read-only; manager must provide feedback |
| **Retry completion** | NO | Cleaner cannot retry. Must wait for manager decision or manager can allow retry. |
| **Cancel job** | NO | Cleaner cannot cancel. Only manager can reassign or reject. |
| **Chat with manager** | YES | Job-scoped chat available for discussion |
| **Visibility on invoice** | YES | Job appears on invoice with "Needs Review" label |
| **View conflict details** | YES | Cleaner can see all conflicts and manager notes |
| **Submit invoice** | YES | Cleaner can submit invoice with needs_review jobs included |
| **Mark done again** | NO | Button is hidden. Status is locked until manager action. |

---

## PART 8: INVOICE BEHAVIOR (UNAMBIGUOUS)

### How Needs_Review Jobs Appear on Invoice

**Visual Representation:**
```
Jobs (3)
├─ Property A - $150.00 - Jan 15 [Completed]
├─ Property B - $120.00 - Jan 16 [Needs Review]
└─ Property C - $200.00 - Jan 17 [Completed]

Total: $470.00
```

**Line Item Display:**
- Job name/property: "Property B"
- Price: "$120.00" (same as original, not adjusted)
- Date: "Jan 16"
- Status badge: "Needs Review" (red)
- Clickable: Yes (cleaner can tap to view job details)

### Can Cleaner Submit Invoice with Needs_Review Jobs Included?

**Answer: YES**

- Cleaner can submit invoice anytime, regardless of job status
- Needs_review jobs are included in invoice total
- Manager will review both completed and needs_review jobs
- Manager can approve, reject, or adjust pricing before payment

**Copy shown to cleaner:**
- "Your invoice includes 1 job that needs review. A manager will contact you about this."
- Submit button text: "Submit Invoice"
- Confirmation message: "Your invoice has been submitted. A manager will review it and contact you within 24 hours."

### What Changes After Manager Approval?

**After Manager Approves (needs_review → completed):**
- Invoice line item status changes from "Needs Review" to "Completed"
- Job status on invoice: "Completed" (green badge)
- Invoice total: Unchanged (price locked)
- Cleaner notification: "Job Approved - Your job has been approved by a manager. Status: Completed."

**After Manager Rejects (needs_review → available or reassigned):**
- Invoice line item is voided (marked as "Voided" with strikethrough)
- Invoice total: Recalculated (voided job removed)
- Job removed from cleaner's list
- Cleaner notification: "Job Reassigned - Your job has been reassigned. You will not be paid for this job."

**After Manager Keeps in needs_review (with notes):**
- Invoice line item status: Still "Needs Review"
- Invoice total: Unchanged
- Cleaner notification: "Job Reviewed - A manager has reviewed your job. Status: Still needs review. [Manager notes]"
- Cleaner can retry completion or chat with manager

---

## PART 9: MANAGER DECISION OUTCOMES

### Manager Action 1: Approve (needs_review → completed)

**Manager sees:**
- Job in "Needs Review" status
- Conflict details (GPS 200m away, 0 photos)
- Cleaner name and contact info
- Override form with reason field

**Manager action:**
- Reviews conflict
- Decides conflict is acceptable (e.g., GPS reading was inaccurate, photos uploaded later)
- Taps "Approve" button
- Enters reason: "GPS reading was inaccurate. Cleaner was at property. Photos uploaded." (optional)

**What cleaner sees:**
- Notification: "✓ Job Approved"
- Message: "Your job has been approved by a manager. Status: Completed."
- Job status badge: "Completed" (green)
- Job detail screen: Status changed to "Completed"
- Conflict section: Hidden
- Invoice: Job status changed to "Completed"
- Available action: "View Invoice"

**Audit trail:**
- Override record created: { jobId, managerId, action: "approve", reason: "...", timestamp }

---

### Manager Action 2: Reject & Reassign (needs_review → available)

**Manager sees:**
- Job in "Needs Review" status
- Conflict details
- Cleaner name and contact info
- Override form with reason field
- Reassign dropdown (select another cleaner or "Unassigned")

**Manager action:**
- Reviews conflict
- Decides conflict is unacceptable (e.g., cleaner was too far, no photos at all)
- Taps "Reject" button
- Enters reason: "GPS was 250m away. No photos uploaded. Job must be redone."
- Selects "Unassigned" (or another cleaner)

**What cleaner sees:**
- Notification: "⚠️ Job Reassigned"
- Message: "Your job has been reassigned. Reason: GPS was 250m away. No photos uploaded. Job must be redone. You will not be paid for this job."
- Job status badge: "Available" (green)
- Job removed from cleaner's job list
- Invoice: Job line item voided (strikethrough, marked "Voided")
- Invoice total: Recalculated (job removed)
- Available actions: None (job no longer assigned to cleaner)

**Audit trail:**
- Override record created: { jobId, managerId, action: "reject", reason: "...", reassignedTo: "unassigned", timestamp }
- Invoice line item voided: { lineItemId, voidedAt, voidReason: "Job reassigned" }

---

### Manager Action 3: Keep in needs_review with Notes (needs_review → needs_review)

**Manager sees:**
- Job in "Needs Review" status
- Conflict details
- Cleaner name and contact info
- Notes field (manager can add notes)
- "Keep in Review" button

**Manager action:**
- Reviews conflict
- Decides to keep job in needs_review pending cleaner action
- Taps "Keep in Review" button
- Enters notes: "GPS reading may have been inaccurate due to signal loss. Please retry completion when you're back at the property."

**What cleaner sees:**
- Notification: "Job Reviewed"
- Message: "A manager has reviewed your job. Status: Still needs review. [Manager notes: GPS reading may have been inaccurate due to signal loss. Please retry completion when you're back at the property.]"
- Job status badge: "Needs Review" (red)
- Job detail screen: Status still "Needs Review"
- Conflict section: Updated with manager notes
- Invoice: Job status still "Needs Review"
- Available actions: "Retry Completion" (if manager allows), "Chat with Manager", "View Invoice"

**Audit trail:**
- Manager note created: { jobId, managerId, notes: "...", timestamp }
- No status change (still needs_review)

---

### Manager Action 4: Override with Force Complete (needs_review → completed)

**Manager sees:**
- Job in "Needs Review" status
- Conflict details
- Cleaner name and contact info
- "Force Complete" button (red/warning color)
- Reason field (required)

**Manager action:**
- Reviews conflict
- Decides to force completion despite conflicts
- Taps "Force Complete" button
- Enters reason: "Cleaner confirmed photos were uploaded to cloud. GPS reading was inaccurate."

**What cleaner sees:**
- Notification: "✓ Job Approved"
- Message: "Your job has been approved by a manager. Status: Completed."
- Job status badge: "Completed" (green)
- Job detail screen: Status changed to "Completed"
- Conflict section: Hidden
- Invoice: Job status changed to "Completed"
- Available action: "View Invoice"

**Audit trail:**
- Override record created: { jobId, managerId, action: "force_complete", reason: "...", timestamp }

---

## PART 10: NOTES FOR IMPLEMENTATION

1. **Atomic Operations:** Job status update and invoice line item creation must be atomic (all-or-nothing).
2. **Conflict Detection:** Server-side only. Client cannot bypass.
3. **Idempotent:** If cleaner taps "Mark Done" twice, second attempt should return same result (no duplicate invoices).
4. **Offline Queuing:** Completion request must be queued locally and retried when online.
5. **Manager Override:** Manager can override "needs_review" status with audit trail.
6. **Invoice Immutability:** Once invoice is submitted, jobs cannot be removed or prices changed.
7. **Copy Tone:** Professional, clear, actionable. No jargon. Always tell cleaner what to do next.
8. **Exact Copy:** All copy in this spec is locked. No variations or rewording without explicit approval.
9. **Permissions:** Cleaner permissions matrix is binding. No additional actions allowed beyond YES column.
10. **Notifications:** All manager decisions trigger notifications to cleaner with exact copy from this spec.

