import {
  mysqlTable,
  text,
  int,
  timestamp,
  boolean,
  decimal,
  varchar,
  mysqlEnum,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const roleEnum = mysqlEnum("role", ["super_manager", "manager", "cleaner"]);
export const jobStatusEnum = mysqlEnum("job_status", [
  "available",
  "accepted",
  "in_progress",
  "completed",
  "needs_review",
]);
export const bookingStatusEnum = mysqlEnum("booking_status", [
  "confirmed",
  "cancelled",
  "no_show",
]);
export const platformEnum = mysqlEnum("platform", ["guesty", "hostaway", "other"]);
export const invoiceStatusEnum = mysqlEnum("invoice_status", [
  "open",
  "submitted",
  "approved",
  "paid",
]);
export const invoiceCycleEnum = mysqlEnum("invoice_cycle", ["1st", "15th", "bi_weekly"]);
export const payTypeEnum = mysqlEnum("pay_type", ["hourly", "per_job"]);
export const damageSeverityEnum = mysqlEnum("damage_severity", ["minor", "moderate", "severe"]);
export const mediaTypeEnum = mysqlEnum("media_type", ["photo", "video"]);
export const notificationTypeEnum = mysqlEnum("notification_type", [
  "job_assigned",
  "job_accepted",
  "job_completed",
  "damage_reported",
  "message",
  "invoice_ready",
]);

// ============================================================================
// BUSINESSES
// ============================================================================

export const businesses = mysqlTable("businesses", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("US"),
  timezone: varchar("timezone", { length: 50 }).default("America/Los_Angeles"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

// ============================================================================
// USERS & ROLES
// ============================================================================

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    role: roleEnum.notNull().default("cleaner"),
    payType: payTypeEnum.default("per_job"), // Cleaner's default pay type (hourly or per_job)
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    businessEmailIdx: unique("users_business_email_unique").on(table.businessId, table.email),
    businessIdx: index("users_business_id_idx").on(table.businessId),
    roleIdx: index("users_role_idx").on(table.role),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// PROPERTIES
// ============================================================================

export const properties = mysqlTable(
  "properties",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zipCode: varchar("zip_code", { length: 20 }),
    country: varchar("country", { length: 100 }).default("US"),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    unitType: varchar("unit_type", { length: 100 }), // e.g., "1BR/1BA", "Studio"
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    businessIdx: index("properties_business_id_idx").on(table.businessId),
  })
);

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ============================================================================
// BOOKINGS (Normalized from PMS platforms)
// ============================================================================

export const bookings = mysqlTable(
  "bookings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    propertyId: varchar("property_id", { length: 64 }).notNull(),
    platform: platformEnum.notNull(), // "guesty", "hostaway", "other"
    externalBookingId: varchar("external_booking_id", { length: 255 }).notNull(),
    guestName: varchar("guest_name", { length: 255 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 20 }),
    guestCount: int("guest_count").notNull().default(1),
    hasPets: boolean("has_pets").notNull().default(false),
    checkInDate: timestamp("check_in_date").notNull(),
    checkOutDate: timestamp("check_out_date").notNull(),
    status: bookingStatusEnum.notNull().default("confirmed"),
    notes: text("notes"),
    lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    businessIdx: index("bookings_business_id_idx").on(table.businessId),
    propertyIdx: index("bookings_property_id_idx").on(table.propertyId),
    platformExternalIdx: unique("bookings_platform_external_unique").on(
      table.platform,
      table.externalBookingId
    ),
    checkOutIdx: index("bookings_check_out_date_idx").on(table.checkOutDate),
  })
);

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ============================================================================
// CLEANING JOBS (Auto-generated from bookings)
// ============================================================================

export const cleaningJobs = mysqlTable(
  "cleaning_jobs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    bookingId: varchar("booking_id", { length: 64 }).notNull().unique(),
    propertyId: varchar("property_id", { length: 64 }).notNull(),
    cleaningDate: timestamp("cleaning_date").notNull(), // Booking checkout date
    status: jobStatusEnum.notNull().default("available"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    instructions: text("instructions"), // Manager's instructions for this job
    assignedCleanerId: varchar("assigned_cleaner_id", { length: 64 }), // Cleaner or manager acting as cleaner
    acceptedAt: timestamp("accepted_at"),
    startedAt: timestamp("started_at"), // When first photo uploaded
    completedAt: timestamp("completed_at"),
    gpsStartLat: decimal("gps_start_lat", { precision: 10, scale: 8 }),
    gpsStartLng: decimal("gps_start_lng", { precision: 11, scale: 8 }),
    gpsEndLat: decimal("gps_end_lat", { precision: 10, scale: 8 }),
    gpsEndLng: decimal("gps_end_lng", { precision: 11, scale: 8 }),
    invoiceId: varchar("invoice_id", { length: 64 }), // Link to invoice after completion
    accessDenied: boolean("access_denied").notNull().default(false), // Guest present, job not started
    payTypeOverride: payTypeEnum, // Manager override for this job's pay type (nullable = use cleaner's default)
    overriddenBy: varchar("overridden_by", { length: 64 }), // Manager who overrode completion
    overrideReason: text("override_reason"), // Why manager overrode (required)
    overriddenAt: timestamp("overridden_at"), // When override occurred
    overrideStatus: varchar("override_status", { length: 50 }), // Explicit: "completed" or "needs_review"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    businessIdx: index("cleaning_jobs_business_id_idx").on(table.businessId),
    bookingIdx: index("cleaning_jobs_booking_id_idx").on(table.bookingId),
    propertyIdx: index("cleaning_jobs_property_id_idx").on(table.propertyId),
    cleanerIdx: index("cleaning_jobs_assigned_cleaner_id_idx").on(table.assignedCleanerId),
    statusIdx: index("cleaning_jobs_status_idx").on(table.status),
    cleaningDateIdx: index("cleaning_jobs_cleaning_date_idx").on(table.cleaningDate),
  })
);

export type CleaningJob = typeof cleaningJobs.$inferSelect;
export type InsertCleaningJob = typeof cleaningJobs.$inferInsert;

// ============================================================================
// INVENTORY (Per-property definitions)
// ============================================================================

export const inventoryItems = mysqlTable(
  "inventory_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    propertyId: varchar("property_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unit: varchar("unit", { length: 50 }), // e.g., "towels", "rolls", "bottles"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    propertyIdx: index("inventory_items_property_id_idx").on(table.propertyId),
  })
);

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

// ============================================================================
// INVENTORY LOGS (Per-job tracking)
// ============================================================================

export const inventoryLogs = mysqlTable(
  "inventory_logs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    inventoryItemId: varchar("inventory_item_id", { length: 64 }).notNull(),
    isUsed: boolean("is_used").notNull().default(false), // true = used/missing, false = in stock
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("inventory_logs_job_id_idx").on(table.jobId),
    inventoryIdx: index("inventory_logs_inventory_item_id_idx").on(table.inventoryItemId),
  })
);

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertInventoryLog = typeof inventoryLogs.$inferInsert;

// ============================================================================
// MEDIA (Photos/Videos)
// ============================================================================

export const media = mysqlTable(
  "media",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    type: mediaTypeEnum.notNull(), // "photo" or "video"
    uri: text("uri").notNull(), // Cloud URL (S3)
    room: varchar("room", { length: 100 }), // e.g., "Master Bedroom", "Kitchen"
    isRequired: boolean("is_required").notNull().default(false),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    isVoided: boolean("is_voided").notNull().default(false), // Soft-void for corrections
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("media_job_id_idx").on(table.jobId),
  })
);

export type Media = typeof media.$inferSelect;
export type InsertMedia = typeof media.$inferInsert;

// ============================================================================
// DAMAGE REPORTS
// ============================================================================

export const damageReports = mysqlTable(
  "damage_reports",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    description: text("description").notNull(),
    severity: damageSeverityEnum.notNull().default("minor"),
    reportedAt: timestamp("reported_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("damage_reports_job_id_idx").on(table.jobId),
  })
);

export type DamageReport = typeof damageReports.$inferSelect;
export type InsertDamageReport = typeof damageReports.$inferInsert;

export const damagePhotos = mysqlTable(
  "damage_photos",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    damageReportId: varchar("damage_report_id", { length: 64 }).notNull(),
    uri: text("uri").notNull(), // Cloud URL (S3)
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    damageIdx: index("damage_photos_damage_report_id_idx").on(table.damageReportId),
  })
);

export type DamagePhoto = typeof damagePhotos.$inferSelect;
export type InsertDamagePhoto = typeof damagePhotos.$inferInsert;

// ============================================================================
// JOB CHAT (Job-scoped only, cleaner ↔ manager)
// ============================================================================

export const jobChat = mysqlTable(
  "job_chat",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    senderId: varchar("sender_id", { length: 64 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("job_chat_job_id_idx").on(table.jobId),
    senderIdx: index("job_chat_sender_id_idx").on(table.senderId),
  })
);

export type JobChat = typeof jobChat.$inferSelect;
export type InsertJobChat = typeof jobChat.$inferInsert;

// ============================================================================
// INVOICES (Rolling per cleaner, append-only until submission)
// ============================================================================

export const invoices = mysqlTable(
  "invoices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    cleanerId: varchar("cleaner_id", { length: 64 }).notNull(),
    status: invoiceStatusEnum.notNull().default("open"),
    invoiceCycle: invoiceCycleEnum.notNull().default("bi_weekly"),
    payType: payTypeEnum.notNull().default("per_job"), // Immutable for this pay cycle (set at invoice creation)
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    pdfUrl: text("pdf_url"), // Generated PDF URL
    submittedAt: timestamp("submitted_at"),
    approvedAt: timestamp("approved_at"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    businessIdx: index("invoices_business_id_idx").on(table.businessId),
    cleanerIdx: index("invoices_cleaner_id_idx").on(table.cleanerId),
    statusIdx: index("invoices_status_idx").on(table.status),
  })
);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============================================================================
// INVOICE LINE ITEMS (Per-job, append-only until invoice submission)
// ============================================================================

export const invoiceLineItems = mysqlTable(
  "invoice_line_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    invoiceId: varchar("invoice_id", { length: 64 }).notNull(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Original job price
    adjustedPrice: decimal("adjusted_price", { precision: 10, scale: 2 }), // Manager override (before submission only)
    isVoided: boolean("is_voided").notNull().default(false), // Soft-void for corrections
    voidReason: text("void_reason"), // Why this line item was voided
    voidedAt: timestamp("voided_at"), // When this line item was voided
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
    jobIdx: index("invoice_line_items_job_id_idx").on(table.jobId),
  })
);

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

// ============================================================================
// SOFT-VOID AUDIT TABLES
// ============================================================================

export const mediaVoidAudit = mysqlTable(
  "media_void_audit",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    mediaId: varchar("media_id", { length: 64 }).notNull(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    voidReason: text("void_reason").notNull(),
    voidedBy: varchar("voided_by", { length: 64 }).notNull(), // User ID who voided
    voidedAt: timestamp("voided_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    mediaIdx: index("media_void_audit_media_id_idx").on(table.mediaId),
    jobIdx: index("media_void_audit_job_id_idx").on(table.jobId),
    userIdx: index("media_void_audit_voided_by_idx").on(table.voidedBy),
  })
);

export type MediaVoidAudit = typeof mediaVoidAudit.$inferSelect;
export type InsertMediaVoidAudit = typeof mediaVoidAudit.$inferInsert;

export const invoiceLineItemVoidAudit = mysqlTable(
  "invoice_line_item_void_audit",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    lineItemId: varchar("line_item_id", { length: 64 }).notNull(),
    invoiceId: varchar("invoice_id", { length: 64 }).notNull(),
    jobId: varchar("job_id", { length: 64 }).notNull(),
    voidReason: text("void_reason").notNull(),
    voidedBy: varchar("voided_by", { length: 64 }).notNull(), // User ID who voided
    voidedAt: timestamp("voided_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    lineItemIdx: index("invoice_line_item_void_audit_line_item_id_idx").on(table.lineItemId),
    invoiceIdx: index("invoice_line_item_void_audit_invoice_id_idx").on(table.invoiceId),
    jobIdx: index("invoice_line_item_void_audit_job_id_idx").on(table.jobId),
    userIdx: index("invoice_line_item_void_audit_voided_by_idx").on(table.voidedBy),
  })
);

export type InvoiceLineItemVoidAudit = typeof invoiceLineItemVoidAudit.$inferSelect;
export type InsertInvoiceLineItemVoidAudit = typeof invoiceLineItemVoidAudit.$inferInsert;

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    type: notificationTypeEnum.notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    relatedJobId: varchar("related_job_id", { length: 64 }), // Link to job if applicable
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("notifications_business_id_idx").on(table.businessId),
    userIdx: index("notifications_user_id_idx").on(table.userId),
    jobIdx: index("notifications_related_job_id_idx").on(table.relatedJobId),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// PMS SYNC LOG (Track sync status for each platform)
// ============================================================================

export const pmsSyncLog = mysqlTable(
  "pms_sync_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    businessId: varchar("business_id", { length: 64 }).notNull(),
    platform: platformEnum.notNull(),
    lastSyncAt: timestamp("last_sync_at").notNull().defaultNow(),
    bookingsCount: int("bookings_count").notNull().default(0),
    jobsCreatedCount: int("jobs_created_count").notNull().default(0),
    jobsUpdatedCount: int("jobs_updated_count").notNull().default(0),
    syncStatus: varchar("sync_status", { length: 50 }).notNull().default("success"), // "success", "error", "pending"
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("pms_sync_log_business_id_idx").on(table.businessId),
    platformIdx: index("pms_sync_log_platform_idx").on(table.platform),
  })
);

export type PmsSyncLog = typeof pmsSyncLog.$inferSelect;
export type InsertPmsSyncLog = typeof pmsSyncLog.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  properties: many(properties),
  bookings: many(bookings),
  cleaningJobs: many(cleaningJobs),
  invoices: many(invoices),
  notifications: many(notifications),
  pmsSyncLogs: many(pmsSyncLog),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  assignedJobs: many(cleaningJobs),
  sentMessages: many(jobChat),
  invoices: many(invoices),
  notifications: many(notifications),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  business: one(businesses, {
    fields: [properties.businessId],
    references: [businesses.id],
  }),
  bookings: many(bookings),
  cleaningJobs: many(cleaningJobs),
  inventoryItems: many(inventoryItems),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  business: one(businesses, {
    fields: [bookings.businessId],
    references: [businesses.id],
  }),
  property: one(properties, {
    fields: [bookings.propertyId],
    references: [properties.id],
  }),
  cleaningJob: one(cleaningJobs),
}));

export const cleaningJobsRelations = relations(cleaningJobs, ({ one, many }) => ({
  business: one(businesses, {
    fields: [cleaningJobs.businessId],
    references: [businesses.id],
  }),
  booking: one(bookings, {
    fields: [cleaningJobs.bookingId],
    references: [bookings.id],
  }),
  property: one(properties, {
    fields: [cleaningJobs.propertyId],
    references: [properties.id],
  }),
  assignedCleaner: one(users, {
    fields: [cleaningJobs.assignedCleanerId],
    references: [users.id],
  }),
  media: many(media),
  damageReports: many(damageReports),
  inventoryLogs: many(inventoryLogs),
  chatMessages: many(jobChat),
  invoiceLineItems: many(invoiceLineItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  property: one(properties, {
    fields: [inventoryItems.propertyId],
    references: [properties.id],
  }),
  logs: many(inventoryLogs),
}));

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  job: one(cleaningJobs, {
    fields: [inventoryLogs.jobId],
    references: [cleaningJobs.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [inventoryLogs.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  job: one(cleaningJobs, {
    fields: [media.jobId],
    references: [cleaningJobs.id],
  }),
}));

export const damageReportsRelations = relations(damageReports, ({ one, many }) => ({
  job: one(cleaningJobs, {
    fields: [damageReports.jobId],
    references: [cleaningJobs.id],
  }),
  photos: many(damagePhotos),
}));

export const damagePhotosRelations = relations(damagePhotos, ({ one }) => ({
  damageReport: one(damageReports, {
    fields: [damagePhotos.damageReportId],
    references: [damageReports.id],
  }),
}));

export const jobChatRelations = relations(jobChat, ({ one }) => ({
  job: one(cleaningJobs, {
    fields: [jobChat.jobId],
    references: [cleaningJobs.id],
  }),
  sender: one(users, {
    fields: [jobChat.senderId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, {
    fields: [invoices.businessId],
    references: [businesses.id],
  }),
  cleaner: one(users, {
    fields: [invoices.cleanerId],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  job: one(cleaningJobs, {
    fields: [invoiceLineItems.jobId],
    references: [cleaningJobs.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  business: one(businesses, {
    fields: [notifications.businessId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  relatedJob: one(cleaningJobs, {
    fields: [notifications.relatedJobId],
    references: [cleaningJobs.id],
  }),
}));

export const pmsSyncLogRelations = relations(pmsSyncLog, ({ one }) => ({
  business: one(businesses, {
    fields: [pmsSyncLog.businessId],
    references: [businesses.id],
  }),
}));
