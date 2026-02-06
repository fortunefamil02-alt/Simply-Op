# Simply Organized — Mobile App Design Document

## Overview

Simply Organized is a cross-platform (iOS + Android) mobile app for short-term rental cleaning operations. The app enables property managers and cleaners to manage cleaning jobs with strict role-based access, offline support, GPS tracking, and read-only Guesty integration.

---

## Design Principles

- **Mobile-First (Portrait 9:16)**: All screens designed for one-handed use in portrait orientation
- **iOS-Native Feel**: Follows Apple Human Interface Guidelines (HIG) with native iOS components
- **Offline-First**: Cleaners can work offline; data syncs automatically when online
- **Role-Based Clarity**: Each role sees only what they need; no confusion or access violations
- **Safety & Accountability**: GPS, photos, and timestamps ensure job integrity

---

## Screen List & Navigation

### Authentication Screens
1. **Login** — Email/password entry with role display
2. **Role Selection** (if applicable) — For users with multiple roles

### Super Manager Screens
1. **Dashboard** — Overview of properties, cleaners, jobs, and revenue
2. **Cleaners List** — Add/remove cleaners, view assignments
3. **Managers List** — Add/remove managers
4. **Properties List** — Link properties, configure inventory
5. **Inventory Setup** — Define per-property inventory items
6. **Job Calendar** — View all jobs across properties
7. **Job Detail** — Full job info, cleaner assignment, chat, override options
8. **Chat** — Job-based messaging with cleaner
9. **Invoice Review** — Approve/adjust pricing before submission
10. **Settings** — Guesty API key, app preferences

### Manager Screens
1. **Dashboard** — Jobs assigned, cleaner status, pending reviews
2. **Jobs List** — Assigned jobs, filtering by status
3. **Job Detail** — Assign cleaner, add instructions, view progress, chat
4. **Cleaners List** — View assigned cleaners, contact info
5. **Properties List** — View assigned properties
6. **Inventory Setup** — Define per-property inventory
7. **Chat** — Job-based messaging with cleaner
8. **Invoice Review** — View cleaner invoices (read-only or adjust if permitted)
9. **Settings** — App preferences

### Cleaner Screens
1. **Job List** — Available jobs (cards), accepted jobs, completed jobs
2. **Job Detail** — Full job info, accept/start/complete flow
3. **Camera Upload** — Capture photos/videos of rooms
4. **Inventory Checklist** — Check off items used or missing
5. **Damage Report** — Photo + notes for damages
6. **Chat** — Job-based messaging with manager
7. **Invoice View** — Current open invoice, submission history
8. **Settings** — Preferences, logout

---

## Screen Details & Layouts

### 1. Login Screen
**Purpose**: Authenticate user and determine role

**Layout**:
- App logo at top
- Email input field
- Password input field
- "Login" button (primary)
- "Forgot Password?" link (secondary)
- Role badge displayed after login (Super Manager / Manager / Cleaner)

**Functionality**:
- Validate credentials against backend
- Store auth token securely (Expo SecureStore)
- Route to appropriate dashboard based on role
- Show error message if login fails

---

### 2. Dashboard (Super Manager / Manager)
**Purpose**: High-level overview of operations

**Layout** (Scrollable):
- **Header**: Welcome message + role badge
- **Quick Stats** (Cards):
  - Total Properties
  - Active Cleaners
  - Jobs This Week
  - Revenue (This Month)
- **Upcoming Jobs** (List):
  - Job card: Property name, date, cleaner assigned, status
  - Tap to view detail
- **Recent Activity** (List):
  - Job completed, damage reported, etc.

**Functionality**:
- Pull-to-refresh to sync with backend
- Tap job card → Job Detail screen
- Tap stat card → Filtered list view

---

### 3. Job List (Cleaner)
**Purpose**: Show available and accepted jobs

**Layout** (FlatList):
- **Filter Tabs**: Available | Accepted | Completed
- **Job Cards** (repeating):
  - Property name & unit
  - Scheduled date
  - Guest count
  - Pets indicator (yes/no)
  - Job price
  - Status badge (Available / Accepted / In Progress / Completed)
  - "Accept" button (if Available)
  - "View" button (if Accepted/In Progress)

**Functionality**:
- Tap "Accept" → Lock job to this cleaner, show confirmation
- Tap "View" → Job Detail screen
- Swipe to refresh
- Offline: Show cached jobs, disable Accept until online

---

### 4. Job Detail (Cleaner)
**Purpose**: Execute job with GPS, photos, inventory, damage tracking

**Layout** (Scrollable):
- **Job Header**:
  - Property name & unit
  - Scheduled date & time
  - Guest count
  - Pets indicator
  - Job price
  - Status badge

- **Job Info Section**:
  - Property address (read-only)
  - Check-in instructions (from manager)
  - Special instructions (from manager)

- **Execution Section** (Conditional based on status):
  - **If Available**: "Accept Job" button
  - **If Accepted**: "Start Job" button (requires GPS check-in)
  - **If In Progress**:
    - Timer (elapsed time since first photo)
    - "Upload Photos" button
    - "Inventory Checklist" section (collapsible)
    - "Damage Report" section (collapsible)
    - "Done" button (enabled only if: all required photos + GPS at property)

- **Chat Section** (collapsible):
  - Recent messages from manager
  - Input field to send message

- **Manager Override** (Super Manager only):
  - "Override Completion" button (if job stuck)

**Functionality**:
- Accept Job: Lock job, show confirmation
- Start Job: Verify GPS at property, start timer, enable photo upload
- Upload Photos: Open camera, capture room photos, upload to cloud
- Inventory Checklist: Check off items used or missing
- Damage Report: Add photos + notes
- Done: Verify GPS at property, submit job completion
- Chat: Send/receive messages in real-time

---

### 5. Camera Upload Screen
**Purpose**: Capture and upload photos/videos

**Layout**:
- **Camera Preview** (full screen)
- **Capture Button** (center bottom)
- **Gallery Button** (left bottom, to select existing photos)
- **Video Toggle** (right bottom, to switch to video mode)
- **Back Button** (top left)

**Functionality**:
- Capture photo/video
- Preview before upload
- Upload to cloud with job ID
- Show upload progress
- Offline: Queue for upload when online
- Mark photo as required/optional

---

### 6. Inventory Checklist Screen
**Purpose**: Track inventory usage or missing items

**Layout** (Scrollable):
- **Header**: Property name, inventory count
- **Inventory Items** (repeating):
  - Checkbox (unchecked = in stock, checked = used/missing)
  - Item name
  - Quantity (e.g., "12 towels")
  - Notes field (optional)

- **Summary**:
  - Items checked: X / Y
  - "Save" button

**Functionality**:
- Check/uncheck items
- Add notes per item
- Save to job record
- Offline: Save locally, sync when online

---

### 7. Damage Report Screen
**Purpose**: Document damages with photos and notes

**Layout**:
- **Header**: Property name
- **Damage List** (repeating):
  - Photo upload area (tap to add photo)
  - Description field
  - Severity dropdown (Minor / Moderate / Severe)
  - "Delete" button

- **Add Damage Button**: Opens form to add new damage
- **Save Button**: Submit damage report

**Functionality**:
- Upload photos of damage
- Add description and severity
- Notify manager immediately (if online)
- Offline: Queue notification for when online
- Manager can view damages in Job Detail

---

### 8. Chat Screen (Job-Based)
**Purpose**: Communicate between cleaner and manager per job

**Layout**:
- **Header**: Job info (property, date)
- **Message List** (FlatList):
  - Messages from manager (left-aligned)
  - Messages from cleaner (right-aligned)
  - Timestamp for each message
  - Read/unread indicator

- **Input Section** (bottom):
  - Text input field
  - "Send" button
  - Attachment button (optional, for photos)

**Functionality**:
- Send/receive messages in real-time
- Offline: Queue messages, send when online
- Show typing indicator (if online)
- Notifications for new messages

---

### 9. Invoice Screen (Cleaner)
**Purpose**: View and submit invoices

**Layout**:
- **Invoice Header**:
  - Invoice ID
  - Period (e.g., "Feb 1-15, 2026")
  - Status (Open / Submitted / Approved / Paid)

- **Invoice Items** (repeating):
  - Job date
  - Property name
  - Job price
  - Status (Completed / Pending Manager Review)

- **Invoice Summary**:
  - Total jobs
  - Total amount
  - Taxes (if applicable)
  - **Grand Total**

- **Submission Section**:
  - Invoice cycle selector (1st / 15th / Bi-weekly)
  - "Submit Invoice" button (if Open)
  - "View PDF" button (if Submitted)

**Functionality**:
- Auto-populate jobs from completed job records
- Submit invoice (locks it)
- Generate PDF
- Offline: Queue submission, send when online

---

### 10. Settings Screen
**Purpose**: User preferences and app configuration

**Layout**:
- **Account Section**:
  - User name (read-only)
  - Role (read-only)
  - "Change Password" button
  - "Logout" button

- **App Preferences**:
  - Dark mode toggle
  - Notification settings
  - GPS accuracy (High / Medium / Low)

- **Super Manager Only**:
  - Guesty API key input
  - "Test Connection" button
  - Sync frequency (Manual / Hourly / Daily)

- **About**:
  - App version
  - "Help & Support" link

**Functionality**:
- Update preferences
- Logout (clear auth token)
- Test Guesty connection
- View app version

---

## Key User Flows

### Flow 1: Cleaner Accepts & Completes a Job

1. **Cleaner opens Job List** → Sees "Available" jobs
2. **Cleaner taps "Accept"** → Job locks to cleaner, status changes to "Accepted"
3. **Cleaner taps "View"** → Job Detail screen
4. **Cleaner taps "Start Job"** → GPS verification required (must be at property)
5. **Timer starts** → Cleaner can now upload photos
6. **Cleaner taps "Upload Photos"** → Camera opens, captures room photos
7. **Photos uploaded** → Timer continues, photos linked to job
8. **Cleaner checks Inventory** → Marks items used or missing
9. **Cleaner reports Damages** (if any) → Photos + notes, manager notified
10. **Cleaner taps "Done"** → GPS verification required (must still be at property)
11. **Job marked "Completed"** → Cleaner sees job in "Completed" tab
12. **Manager reviews** → Photos, inventory, damages visible
13. **Manager approves** → Job locked, cleaner paid
14. **Invoice auto-updates** → Job added to cleaner's open invoice

---

### Flow 2: Manager Assigns Job & Monitors Progress

1. **Manager opens Dashboard** → Sees upcoming jobs
2. **Manager taps job** → Job Detail screen
3. **Manager assigns Cleaner** → Dropdown to select from available cleaners
4. **Manager adds Instructions** → Property-specific or job-specific notes
5. **Manager taps "Save"** → Job assigned, cleaner notified
6. **Cleaner accepts job** → Manager sees status update in real-time
7. **Cleaner starts job** → Manager sees timer start
8. **Cleaner uploads photos** → Manager sees photos appear in real-time
9. **Cleaner reports damage** → Manager gets notification
10. **Manager reviews damage** → Photos + notes visible
11. **Cleaner completes job** → Manager sees "Completed" status
12. **Manager reviews** → All photos, inventory, damages visible
13. **Manager approves or requests changes** → Via chat or override
14. **Manager reviews Invoice** → Can adjust price before cleaner submits

---

### Flow 3: Super Manager Links Guesty & Syncs Bookings

1. **Super Manager opens Settings**
2. **Super Manager enters Guesty API key** → "Test Connection" button
3. **Super Manager taps "Test"** → Verifies connection
4. **Super Manager sets Sync Frequency** → Manual / Hourly / Daily
5. **Bookings sync** → Check-in/check-out dates, guest count, pets
6. **Job cards auto-generate** → One per booking checkout date
7. **If checkout date moves** → Job date auto-updates
8. **Super Manager can override** → Manually adjust job dates if needed

---

## Color Scheme

**Brand Colors** (iOS-inspired):
- **Primary**: `#0a7ea4` (Teal) — Actions, buttons, highlights
- **Background**: `#ffffff` (Light) / `#151718` (Dark)
- **Surface**: `#f5f5f5` (Light) / `#1e2022` (Dark)
- **Foreground**: `#11181C` (Light) / `#ECEDEE` (Dark)
- **Muted**: `#687076` (Light) / `#9BA1A6` (Dark)
- **Border**: `#E5E7EB` (Light) / `#334155` (Dark)
- **Success**: `#22C55E` (Green) — Completed, approved
- **Warning**: `#F59E0B` (Amber) — Pending review, needs attention
- **Error**: `#EF4444` (Red) — Damages, failures, overrides

---

## Typography

- **Headlines**: SF Pro Display (iOS) / Roboto (Android), 28px, bold
- **Titles**: SF Pro Display / Roboto, 20px, semibold
- **Body**: SF Pro Text / Roboto, 16px, regular
- **Captions**: SF Pro Text / Roboto, 12px, regular, muted color

---

## Interaction Patterns

- **Press Feedback**: Buttons scale to 0.97 + light haptic
- **Loading**: Spinner with "Loading..." text
- **Errors**: Red banner with error message + retry button
- **Success**: Green banner with checkmark + success message
- **Offline Indicator**: Gray banner at top "Offline — Data will sync when online"

---

## Accessibility

- **Minimum Touch Target**: 44×44 pt (iOS) / 48×48 dp (Android)
- **Color Contrast**: WCAG AA (4.5:1 for text)
- **Font Scaling**: Supports dynamic type (iOS) / large text (Android)
- **VoiceOver / TalkBack**: All interactive elements labeled

---

## Data Structures (Preview)

### Job
```
{
  id: string
  propertyId: string
  cleanerId: string (assigned cleaner)
  managerId: string (assigning manager)
  scheduledDate: ISO string
  status: "Available" | "Accepted" | "In Progress" | "Completed" | "Needs Review"
  startTime: ISO string (when first photo uploaded)
  endTime: ISO string (when Done pressed)
  gpsStart: { lat, lng }
  gpsEnd: { lat, lng }
  price: number
  photos: Photo[]
  inventory: InventoryItem[]
  damages: Damage[]
  invoiceId: string (optional)
  createdAt: ISO string
  updatedAt: ISO string
}
```

### Photo
```
{
  id: string
  jobId: string
  uri: string (cloud URL)
  uploadedAt: ISO string
  isRequired: boolean
  room: string (e.g., "Master Bedroom")
}
```

### InventoryItem
```
{
  id: string
  propertyId: string
  name: string
  quantity: number
  unit: string (e.g., "towels", "rolls")
  used: boolean
  notes: string
}
```

### Damage
```
{
  id: string
  jobId: string
  description: string
  severity: "Minor" | "Moderate" | "Severe"
  photos: Photo[]
  reportedAt: ISO string
}
```

---

## Next Steps

1. **Phase 2**: Design database schema (users, roles, jobs, properties, inventory, chat)
2. **Phase 3**: Implement authentication and role-based access control
3. **Phase 4**: Build job card UI and job flow logic with GPS and timer
4. **Phase 5**: Implement photo/video upload and inventory management
5. **Phase 6**: Build job-based chat system
6. **Phase 7**: Implement Guesty read-only integration
7. **Phase 8**: Implement offline mode with automatic sync
8. **Phase 9**: Test and prepare deployment
