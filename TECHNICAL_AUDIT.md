# Simply Organized — Technical Audit Report

**Date:** February 6, 2026  
**Checkpoint:** 33fb2985  
**Scope:** Verification of correctness, completeness, and safety  
**Methodology:** Code review against explicit invariants, not design documents

---

## VERIFIED SAFE

### 1. Database Schema Isolation
- ✅ **Bookings table correctly isolated from cleaner queries**
  - File: `drizzle/schema.ts` lines 140-180
  - Bookings table contains: guestName, guestEmail, guestPhone, guestCount, hasPets
  - Schema enforces separation: no foreign key from cleaningJobs to bookings in query path
  - Cleaners only see: propertyName, propertyAddress, cleaningDate, guestCount, hasPets
  - Evidence: Job card component (`components/job-card.tsx`) never queries bookings table

### 2. Role-Based Access Control Middleware
- ✅ **Server-side role enforcement via tRPC middleware**
  - File: `server/_core/trpc.ts` lines 31-66
  - Three middleware procedures defined:
    - `superManagerProcedure` (line 31): checks `ctx.user.role === "super_manager"`
    - `managerProcedure` (line 48): checks role is manager or super_manager
    - `protectedProcedure` (line 29): checks user exists
  - All middleware throw `TRPCError` with code "FORBIDDEN" if role check fails
  - Client-side hooks exist but are NOT used for access control (only for UI)
  - File: `lib/auth-context.tsx` lines 248-291: Permission hooks are UI-only

### 3. Business ID Scoping
- ✅ **Schema enforces businessId on all multi-tenant tables**
  - File: `drizzle/schema.ts`:
    - `users` table (line 82): businessId required, indexed (line 95)
    - `properties` table (line 108): businessId required, indexed
    - `bookings` table (line 142): businessId required, indexed
    - `cleaningJobs` table (line 160): businessId required, indexed
    - `invoices` table (line 285): businessId required, indexed
    - `notifications` table (line 330): businessId required, indexed
  - All tables have index on businessId for query performance
  - Unique constraint on (businessId, email) in users table (line 94)

### 4. Job Chat Isolation
- ✅ **Chat schema prevents cross-job and guest messaging**
  - File: `drizzle/schema.ts` lines 250-265
  - jobChat table has:
    - jobId (required, indexed) — one thread per job
    - senderId (required, indexed) — who sent message
    - No recipientId field — cannot specify recipient, only job
  - Relationship: jobChat → cleaningJobs (one-to-many)
  - No relationship to bookings or guests
  - Chat locked on job completion (schema ready, enforcement pending)

### 5. GPS Coordinates Immutable Storage
- ✅ **GPS points stored in cleaningJobs table, never updated**
  - File: `drizzle/schema.ts` lines 160-220
  - gpsStartLat, gpsStartLng (line 189-190): Set when job starts, never updated
  - gpsEndLat, gpsEndLng (line 191-192): Set when job completes, never updated
  - No UPDATE clause modifies these fields after initial set
  - Stored as DECIMAL(10,8) and DECIMAL(11,8) for precision

### 6. Invoice Append-Only Design
- ✅ **Schema enforces immutability of submitted invoices**
  - File: `drizzle/schema.ts` lines 280-310
  - invoices table has status enum: open, submitted, approved, paid (line 289)
  - invoiceLineItems table (line 312-325):
    - Links invoiceId + jobId + price
    - No UPDATE or DELETE logic in schema
    - Immutable by design (no triggers, no soft deletes)
  - Once invoice status = "submitted", no new line items can be added (enforced at application layer, not DB)

---

## VIOLATIONS FOUND

### VIOLATION #1: No Server-Side Job API Endpoints
- **Issue:** Job queries are not implemented on server; client uses mock data from AsyncStorage
- **File:** `server/routers.ts` lines 1-28
  - Only `system` and `auth` routers defined
  - TODO comment at line 20-21: "add feature routers here"
  - No job router, no job queries, no job mutations
- **File:** `app/(cleaner)/jobs.tsx` lines 63-96
  - `loadJobs()` function loads from AsyncStorage only (line 69)
  - Comment at line 84: "TODO: Replace with actual API call"
  - No actual API call to backend
- **Risk:** CRITICAL
  - Cleaners cannot fetch real jobs from database
  - No server-side businessId filtering
  - No server-side role checking for job access
  - If API is added later without proper scoping, data leakage possible
- **Fix:** 
  - Create `jobs` router in `server/routers.ts`
  - Add `cleanerRouter` with procedure: `list: protectedProcedure.query(({ ctx }) => db.query.cleaningJobs.findMany({ where: and(eq(cleaningJobs.businessId, ctx.user.businessId), eq(cleaningJobs.assignedCleanerId, ctx.user.id)) }))`
  - Add `managerRouter` with procedure: `list: managerProcedure.query(({ ctx }) => db.query.cleaningJobs.findMany({ where: eq(cleaningJobs.businessId, ctx.user.businessId) }))`
  - Update client to call API instead of AsyncStorage

### VIOLATION #2: No Server-Side Login Endpoint
- **Issue:** Authentication is mocked on client; no backend validation
- **File:** `lib/auth-context.tsx` lines 133-174
  - `login()` function has TODO comment at line 138-143: "Call backend login endpoint"
  - Actual implementation (lines 145-157): Creates mock user with hardcoded role "cleaner"
  - No password validation
  - No database lookup
  - No token generation
- **Risk:** CRITICAL
  - Any user can login as any email
  - No role verification
  - Token is fake (line 159: `token_${Date.now()}`)
  - No session validation on backend
- **Fix:**
  - Create `auth/login` endpoint in `server/routers.ts`
  - Endpoint should:
    1. Accept email + password
    2. Query users table by email
    3. Verify password hash
    4. Generate JWT token
    5. Return user + token
  - Update client to call real endpoint

### VIOLATION #3: No Server-Side GPS Validation
- **Issue:** GPS check is client-side only; can be spoofed
- **File:** `app/(cleaner)/job-detail.tsx` lines 98-140
  - `checkGPS()` function runs entirely on client
  - Gets device location via `Location.getCurrentPositionAsync()` (line 116)
  - Calculates distance using Haversine formula (line 125-135)
  - No server verification
- **Risk:** HIGH
  - Malicious client can fake GPS coordinates
  - Can mark job complete from anywhere
  - GPS coordinates stored in database are client-provided, not verified
  - No audit trail of spoofing attempts
- **Fix:**
  - Add server-side GPS validation in job completion endpoint
  - Endpoint should:
    1. Accept jobId + clientLat + clientLng
    2. Query job to get propertyId
    3. Query property to get propertyLat + propertyLng
    4. Calculate distance server-side (Haversine)
    5. Verify distance ≤ 50 meters
    6. Only then update job status
  - Store GPS coordinates server-side, not client-provided

### VIOLATION #4: No Idempotency Keys for Events
- **Issue:** Event emission has no idempotency protection
- **File:** `server/notifications/job-events.ts` (entire file)
  - Functions like `emitJobCompleted()` (lines 50-70) have no idempotency key
  - If called twice (network retry, duplicate message), fires twice
  - No check for "already emitted"
- **Risk:** MEDIUM
  - Duplicate notifications sent
  - Duplicate invoice line items possible
  - Duplicate payments possible
- **Fix:**
  - Add `eventId` field to notifications table (UUID)
  - Add unique constraint on (jobId, eventType, eventId)
  - Check for existing event before emitting new one
  - Or: Add idempotency key to event emission function

### VIOLATION #5: No Permission Check on Job Detail Access
- **Issue:** Cleaner can access any job detail if they know jobId
- **File:** `app/(cleaner)/job-detail.tsx` lines 63-96
  - `loadJobDetail()` loads job from AsyncStorage by jobId
  - No check that job is assigned to current user
  - If API is added, must verify cleaner is assignedCleanerId
- **Risk:** MEDIUM
  - Cleaner can view other cleaners' jobs
  - Cleaner can see job details they shouldn't
- **Fix:**
  - Add server-side check in job detail endpoint:
    ```typescript
    const job = await db.query.cleaningJobs.findFirst({
      where: and(
        eq(cleaningJobs.id, jobId),
        eq(cleaningJobs.businessId, ctx.user.businessId),
        eq(cleaningJobs.assignedCleanerId, ctx.user.id) // Only assigned cleaner
      ),
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    ```

### VIOLATION #6: No Validation of Job Status Transitions
- **Issue:** Job status can transition illegally
- **File:** `app/(cleaner)/job-detail.tsx` lines 180-215
  - `handleStartJob()` sets status to "in_progress" without checking current status
  - No guard: can only start if status === "accepted"
  - `handleCompleteJob()` sets status to "completed" without checking
  - No guard: can only complete if status === "in_progress"
- **Risk:** MEDIUM
  - Job can transition: available → in_progress (skip accepted)
  - Job can transition: completed → in_progress (go backwards)
  - Multiple concurrent starts/completes possible
- **Fix:**
  - Add server-side validation in job update endpoints:
    ```typescript
    const currentJob = await db.query.cleaningJobs.findFirst({
      where: eq(cleaningJobs.id, jobId),
    });
    if (action === "start" && currentJob.status !== "accepted") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Job must be accepted first" });
    }
    if (action === "complete" && currentJob.status !== "in_progress") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Job must be in progress" });
    }
    ```

### VIOLATION #7: No Atomic Job Completion
- **Issue:** Job completion is not atomic; race conditions possible
- **File:** `app/(cleaner)/job-detail.tsx` lines 180-215
  - Client updates job status locally
  - No server-side atomic transaction
  - If two cleaners try to complete same job, both succeed locally
- **Risk:** MEDIUM
  - Two cleaners can complete same job
  - Invoice line items added twice
  - Payment issued twice
- **Fix:**
  - Use database transaction for job completion:
    ```typescript
    await db.transaction(async (tx) => {
      const job = await tx.query.cleaningJobs.findFirst({
        where: eq(cleaningJobs.id, jobId),
      });
      if (job.status !== "in_progress") throw new Error("Invalid state");
      
      await tx.update(cleaningJobs)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(cleaningJobs.id, jobId));
      
      // Add to invoice atomically
      const invoice = await tx.query.invoices.findFirst({
        where: and(
          eq(invoices.cleanerId, ctx.user.id),
          eq(invoices.status, "open")
        ),
      });
      if (!invoice) {
        const newInvoice = await tx.insert(invoices).values({...});
        await tx.insert(invoiceLineItems).values({...});
      } else {
        await tx.insert(invoiceLineItems).values({...});
      }
    });
    ```

---

## MISSING ENFORCEMENT

### 1. Invoice Immutability After Submission
- **Status:** Schema ready, enforcement missing
- **File:** `drizzle/schema.ts` lines 280-325
- **Missing:** No trigger or check to prevent adding line items to submitted invoice
- **Current:** Application layer only (not enforced)
- **Enforcement:** Add unique constraint on (invoiceId) where status = "submitted" + check before insert:
  ```sql
  ALTER TABLE invoice_line_items ADD CONSTRAINT check_invoice_not_submitted
  CHECK (NOT EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.status = 'submitted'))
  ```
  Or: Application-level check in mutation

### 2. One Open Invoice Per Cleaner Per Cycle
- **Status:** Schema ready, enforcement missing
- **File:** `drizzle/schema.ts` lines 280-310
- **Missing:** No unique constraint on (cleanerId, cycle) where status = "open"
- **Current:** Application layer only
- **Enforcement:** Add unique constraint:
  ```sql
  ALTER TABLE invoices ADD CONSTRAINT unique_open_invoice_per_cycle
  UNIQUE (cleaner_id, invoice_cycle) WHERE status = 'open'
  ```

### 3. Job Cannot Be Accepted If Already Assigned
- **Status:** Logic missing entirely
- **File:** `app/(cleaner)/jobs.tsx` lines 130-160
- **Missing:** No check that job is still "available" before accepting
- **Current:** No guard at all
- **Enforcement:** Add server-side check:
  ```typescript
  const job = await db.query.cleaningJobs.findFirst({
    where: eq(cleaningJobs.id, jobId),
  });
  if (job.status !== "available") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Job is no longer available" });
  }
  ```

### 4. Cleaner Removed From Job Does NOT Affect Invoice
- **Status:** Design ready, enforcement missing
- **File:** `drizzle/schema.ts` lines 160-220
- **Missing:** No logic to handle cleaner removal
- **Current:** No removal endpoint exists
- **Enforcement:** When removing cleaner from job:
  1. Do NOT delete invoiceLineItems
  2. Do NOT modify invoices
  3. Only set job.assignedCleanerId = null
  4. Job becomes "available" again

### 5. Critical Events Bypass Quiet Hours
- **Status:** Schema ready, enforcement missing
- **File:** `server/notifications/job-events.ts` lines 1-50
- **Missing:** No quiet hours logic implemented
- **Current:** isCritical flag exists, but no enforcement
- **Enforcement:** In notification delivery:
  ```typescript
  if (notification.isCritical) {
    // Send immediately, bypass quiet hours
    await sendPushNotification(notification, { priority: "high", sound: "critical" });
  } else {
    // Respect quiet hours
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 22 || hour < 8) {
      // Queue for morning delivery
      await queueNotification(notification);
    } else {
      await sendPushNotification(notification);
    }
  }
  ```

### 6. Manager Override Logging
- **Status:** Not implemented
- **File:** `drizzle/schema.ts` (no override audit table)
- **Missing:** No audit log for manager overrides
- **Current:** No override endpoint exists
- **Enforcement:** Create `jobOverrides` table:
  ```typescript
  export const jobOverrides = mysqlTable("job_overrides", {
    id: varchar("id", { length: 64 }).primaryKey(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    overriddenBy: varchar("overridden_by", { length: 64 }).notNull(), // Super manager
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });
  ```

---

## SAFE TO PROCEED WITH

### 1. Database Schema Structure
- ✅ 16 tables properly normalized
- ✅ All relationships defined
- ✅ Indexes on frequently queried columns
- ✅ Unique constraints prevent duplicates
- ✅ Enums enforce valid values

### 2. Authentication Context (Client-Side)
- ✅ Secure token storage (Expo SecureStore)
- ✅ User data persistence (AsyncStorage)
- ✅ Session restoration on app launch
- ✅ Logout clears all data
- ✅ Permission hooks for UI (not security)

### 3. Job Card UI
- ✅ Displays only safe data: propertyName, address, date, guestCount, hasPets
- ✅ Never displays: guestName, guestEmail, guestPhone
- ✅ Status badge correctly shows job state

### 4. GPS Tracking (Client-Side)
- ✅ Uses Haversine formula correctly
- ✅ 50-meter radius validation logic sound
- ✅ Stores coordinates for audit trail
- ⚠️ Must be verified server-side (see VIOLATIONS #3)

### 5. Timer Implementation
- ✅ Starts on job start
- ✅ Displays elapsed time correctly
- ✅ Stored in startedAt field

### 6. Offline Job Caching
- ✅ AsyncStorage caching works
- ✅ Jobs loadable when offline
- ✅ Local state updates function
- ⚠️ No sync engine yet (expected, not unsafe)

---

## DO NOT BUILD NEXT UNTIL FIXED

### CRITICAL (Blocks MVP)

1. **Implement Server-Side Job API**
   - File: `server/routers.ts`
   - Add jobs router with list/detail/accept/start/complete endpoints
   - All endpoints must check businessId and role
   - Estimated effort: 4-6 hours

2. **Implement Real Authentication**
   - File: `server/routers.ts`
   - Add auth/login endpoint with password validation
   - Generate JWT tokens
   - Update client to call real endpoint
   - Estimated effort: 3-4 hours

3. **Add Server-Side GPS Validation**
   - File: `server/routers.ts` (job completion endpoint)
   - Verify GPS coordinates server-side before accepting
   - Store verified coordinates, not client-provided
   - Estimated effort: 2-3 hours

4. **Add Job Status Transition Guards**
   - File: `server/routers.ts` (all job mutation endpoints)
   - Validate current status before allowing transition
   - Prevent illegal state transitions
   - Estimated effort: 2-3 hours

5. **Make Job Completion Atomic**
   - File: `server/routers.ts` (job completion endpoint)
   - Use database transaction
   - Add invoice line item atomically
   - Estimated effort: 2-3 hours

### HIGH (Blocks Invoice System)

6. **Add Invoice Immutability Enforcement**
   - File: `drizzle/schema.ts` or application layer
   - Prevent adding line items to submitted invoices
   - Estimated effort: 1-2 hours

7. **Add One-Open-Invoice-Per-Cycle Constraint**
   - File: `drizzle/schema.ts` or application layer
   - Unique constraint on (cleanerId, cycle) where status = "open"
   - Estimated effort: 1 hour

8. **Add Idempotency Keys to Events**
   - File: `server/notifications/job-events.ts`
   - Add eventId to notifications table
   - Check for duplicate events before emitting
   - Estimated effort: 2-3 hours

### MEDIUM (Blocks Manager Features)

9. **Add Manager Override Audit Log**
   - File: `drizzle/schema.ts`
   - Create jobOverrides table
   - Log all overrides with reason
   - Estimated effort: 2-3 hours

10. **Add Job Detail Permission Check**
    - File: `server/routers.ts` (job detail endpoint)
    - Verify cleaner is assignedCleanerId
    - Estimated effort: 1 hour

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Verified Safe | 6 | ✅ OK |
| Violations Found | 7 | ❌ CRITICAL |
| Missing Enforcement | 6 | ⚠️ HIGH PRIORITY |
| Safe to Proceed | 6 | ✅ OK |
| Do Not Build Until Fixed | 10 | ❌ BLOCKING |

**Overall Assessment:** Codebase has solid schema design and client-side logic, but is **NOT SAFE FOR PRODUCTION** due to missing server-side validation, authentication, and API endpoints. All critical violations must be fixed before MVP launch.

**Estimated Effort to Fix:** 20-30 hours of development

**Recommended Next Steps:**
1. Implement server-side job API (CRITICAL)
2. Implement real authentication (CRITICAL)
3. Add server-side GPS validation (CRITICAL)
4. Add job status transition guards (CRITICAL)
5. Make job completion atomic (CRITICAL)
6. Add invoice safety constraints (HIGH)
7. Add idempotency keys to events (HIGH)

---

**Audit Date:** February 6, 2026  
**Auditor:** Manus Technical Review  
**Checkpoint:** 33fb2985
