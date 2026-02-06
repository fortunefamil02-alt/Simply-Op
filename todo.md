# Simply Organized — Project TODO

## Phase 1: Project Setup & Branding
- [ ] Generate custom app logo and update branding
- [ ] Update app.config.ts with app name and logo URL
- [ ] Configure theme colors (primary teal, success green, error red)

## Phase 2: Database Schema & Backend Setup
- [ ] Design and create User table (id, email, password, role, createdAt)
- [ ] Design and create Role table (Super Manager, Manager, Cleaner)
- [ ] Design and create Property table (id, name, address, coordinates, managerId)
- [ ] Design and create Job table (id, propertyId, cleanerId, managerId, status, dates, GPS, price)
- [ ] Design and create Photo table (id, jobId, uri, uploadedAt, isRequired, room)
- [ ] Design and create InventoryItem table (id, propertyId, name, quantity, unit)
- [ ] Design and create Damage table (id, jobId, description, severity, photos)
- [ ] Design and create Chat table (id, jobId, senderId, message, timestamp)
- [ ] Design and create Invoice table (id, cleanerId, period, status, totalAmount)
- [ ] Design and create InvoiceItem table (id, invoiceId, jobId, price)
- [ ] Set up database migrations with Drizzle ORM

## Phase 3: Authentication & Role-Based Access Control
- [x] Create Login screen with email/password input
- [x] Implement authentication API endpoint (POST /auth/login)
- [x] Implement JWT token generation and storage (Expo SecureStore)
- [x] Create useAuth hook for auth state management
- [x] Implement role-based routing (redirect to appropriate dashboard)
- [x] Create protected route wrapper for role-specific screens
- [x] Implement logout functionality
- [ ] Add "Forgot Password" flow (optional for MVP)

## Phase 4: Job Card UI & Job Flow Logic
- [x] Create Job List screen for Cleaners (Available/Accepted/Completed tabs)
- [x] Create Job Card component (property, date, guest count, pets, price, status)
- [x] Implement "Accept Job" button and logic (lock job to cleaner)
- [x] Create Job Detail screen (full job info, instructions, status)
- [x] Implement "Start Job" button with GPS verification
- [x] Implement timer (start on first photo, display elapsed time)
- [x] Implement "Done" button with GPS verification
- [x] Add GPS location tracking (expo-location)
- [x] Implement GPS check-in/check-out validation
- [x] Add offline support for job list (cache jobs locally)
- [x] Create cleaner layout with tab navigation
- [x] Implement role-based routing (cleaners to job list)

## Phase 5: Photo/Video Upload & Inventory Management
- [ ] Create Camera Upload screen
- [ ] Implement photo capture (expo-camera)
- [ ] Implement video capture (expo-video)
- [ ] Implement photo/video upload to cloud storage (S3)
- [ ] Track upload progress and show UI feedback
- [ ] Create Inventory Checklist screen
- [ ] Implement inventory item check/uncheck logic
- [ ] Create Damage Report screen
- [ ] Implement damage photo upload and notes
- [ ] Add damage severity selector (Minor/Moderate/Severe)
- [ ] Implement manager notification on damage report

## Phase 6: Job-Based Chat System
- [ ] Create Chat screen (job-specific messages)
- [ ] Implement real-time messaging (WebSocket or polling)
- [ ] Implement message send/receive logic
- [ ] Add message timestamps and read/unread indicators
- [ ] Implement offline message queuing
- [ ] Add typing indicator (optional)
- [ ] Implement message notifications

## Phase 7: Manager Screens & Job Assignment
- [ ] Create Manager Dashboard screen
- [ ] Create Job List screen for Managers (all assigned jobs)
- [ ] Implement job assignment UI (select cleaner from dropdown)
- [ ] Implement instruction input (property-specific and job-specific)
- [ ] Create Cleaners List screen (view assigned cleaners)
- [ ] Create Properties List screen (view assigned properties)
- [ ] Create Inventory Setup screen (define per-property inventory)
- [ ] Implement inventory CRUD (add/edit/delete items)
- [ ] Create Invoice Review screen (view cleaner invoices)
- [ ] Implement price adjustment before invoice submission

## Phase 8: Super Manager Screens & Guesty Integration
- [ ] Create Super Manager Dashboard screen
- [ ] Create Cleaners List screen (add/remove cleaners)
- [ ] Create Managers List screen (add/remove managers)
- [ ] Create Settings screen with Guesty API key input
- [ ] Implement Guesty API integration (read-only)
- [ ] Implement booking sync (check-in/check-out, guest count, pets)
- [ ] Implement auto-job-generation from bookings
- [ ] Implement auto-job-date-update when checkout moves
- [ ] Add "Test Connection" button for Guesty
- [ ] Implement sync frequency settings (Manual/Hourly/Daily)

## Phase 9: Invoicing System
- [ ] Create Invoice screen for Cleaners (view open invoice)
- [ ] Implement invoice auto-population from completed jobs
- [ ] Implement invoice cycle selector (1st/15th/Bi-weekly)
- [ ] Implement "Submit Invoice" button (locks invoice)
- [ ] Implement PDF generation for invoices
- [ ] Implement invoice history view
- [ ] Add manager price adjustment before submission

## Phase 10: Offline Mode & Sync
- [ ] Implement local data caching (AsyncStorage or MMKV)
- [ ] Implement offline indicator (banner at top)
- [ ] Implement job list offline support
- [ ] Implement photo upload queuing (offline)
- [ ] Implement chat message queuing (offline)
- [ ] Implement invoice submission queuing (offline)
- [ ] Implement automatic sync when online
- [ ] Implement conflict resolution (manager review if conflicts)
- [ ] Add sync status indicator

## Phase 11: Settings & User Preferences
- [ ] Create Settings screen (all roles)
- [ ] Implement dark mode toggle
- [ ] Implement notification settings
- [ ] Implement GPS accuracy settings
- [ ] Implement "Change Password" flow
- [ ] Implement "Logout" button
- [ ] Add app version display
- [ ] Add "Help & Support" link

## Phase 12: Testing & Refinement
- [ ] Test authentication flow (all roles)
- [ ] Test job acceptance and completion flow
- [ ] Test GPS tracking (start/end verification)
- [ ] Test photo/video upload
- [ ] Test inventory checklist
- [ ] Test damage reporting
- [ ] Test chat messaging
- [ ] Test offline mode (disable network, verify caching)
- [ ] Test sync when online
- [ ] Test Guesty integration (booking sync)
- [ ] Test invoice generation and submission
- [ ] Test role-based access (verify permissions)
- [ ] Test on iOS and Android (real devices or emulators)
- [ ] Performance testing (large job lists, many photos)

## Phase 13: Deployment & Documentation
- [ ] Create deployment guide for iOS (TestFlight/App Store)
- [ ] Create deployment guide for Android (Google Play)
- [ ] Create user documentation (manager guide, cleaner guide)
- [ ] Create admin documentation (Guesty setup, user management)
- [ ] Test deployment on both platforms
- [ ] Prepare release notes

## Known Constraints & Hard Rules
- ✅ Cleaners never see guest names or contact info
- ✅ Cleaners cannot contact guests inside app
- ✅ App never modifies bookings (read-only Guesty)
- ✅ Job cannot complete without photos
- ✅ GPS enforcement always on (start/end verification)
- ✅ Manager can override job completion (Super Manager only)
- ✅ Offline-first architecture (sync when online)
- ✅ Role-based access control (strict permissions)


## Phase 5B: Event-Driven Notifications & Job Chat (COMPLETED)
- [x] Design event-driven notification architecture
- [x] Create notification types (push, in-app, silent)
- [x] Implement role-based notification delivery rules
- [x] Create job-scoped chat system (cleaner ↔ manager only)
- [x] Implement message notifications
- [x] Create offline notification queue with retry logic
- [x] Implement critical alert system (bypass quiet hours)
- [x] Add chat locking on job completion
- [x] Create event emission helpers for job lifecycle
- [x] Implement job event flows (available, assigned, accepted, started, completed, cancelled, reassigned)
- [x] Implement critical alert events (damage, cleaner removed, override request, GPS mismatch, access denied)
- [x] Implement booking and invoice events
- [x] Document event-driven architecture and notification flows
