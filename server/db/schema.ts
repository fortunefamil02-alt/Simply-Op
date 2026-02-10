import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  decimal,
  json,
  varchar,
  index,
  foreignKey,
  primaryKey,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const roleEnum = pgEnum("role", ["super_manager", "manager", "cleaner", "founder"]);
export const businessStatusEnum = pgEnum("business_status", ["pending", "active", "suspended"]);
export const jobStatusEnum = pgEnum("job_status", [
  "available",
  "accepted",
  "in_progress",
  "completed",
  "needs_review",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "open",
  "submitted",
  "approved",
  "paid",
]);
export const invoiceCycleEnum = pgEnum("invoice_cycle", ["1st", "15th", "bi_weekly"]);
export const payTypeEnum = pgEnum("pay_type", ["hourly", "per_job"]);
export const damageSeverityEnum = pgEnum("damage_severity", ["minor", "moderate", "severe"]);
export const auditActionEnum = pgEnum("audit_action", [
  "business_created",
  "business_activated",
  "business_suspended",
  "user_created",
  "user_role_changed",
  "user_deactivated",
]);

// ============================================================================
// GOVERNANCE & BUSINESSES
// ============================================================================

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    founderId: text("founder_id").notNull(),
    status: businessStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
  },
  (table) => ({
    founderIdx: index("businesses_founder_id_idx").on(table.founderId),
    statusIdx: index("businesses_status_idx").on(table.status),
  })
);

/**
 * Immutable audit log - records all governance actions
 * Cannot be modified or deleted after creation
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    founderId: text("founder_id").notNull(),
    action: auditActionEnum("action").notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // "business", "user"
    targetId: text("target_id").notNull(),
    details: json("details"), // JSON object with action-specific details
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    founderIdx: index("audit_log_founder_id_idx").on(table.founderId),
    actionIdx: index("audit_log_action_idx").on(table.action),
    targetIdx: index("audit_log_target_id_idx").on(table.targetId),
    createdIdx: index("audit_log_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// USERS & ROLES
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    role: roleEnum("role").notNull().default("cleaner"),
    businessId: text("business_id"), // Business this user belongs to (nullable for founder)
    companyId: text("company_id"), // Super Manager's company (deprecated, use businessId)
    managerId: text("manager_id"), // Manager's parent Super Manager
    payType: payTypeEnum("pay_type").default("per_job"), // Cleaner's default pay type (hourly or per_job)
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
    businessIdx: index("users_business_id_idx").on(table.businessId),
    companyIdx: index("users_company_id_idx").on(table.companyId),
  })
);

// ============================================================================
// PROPERTIES
// ============================================================================

export const properties = pgTable(
  "properties",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    managerId: text("manager_id").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("properties_company_id_idx").on(table.companyId),
    managerIdx: index("properties_manager_id_idx").on(table.managerId),
  })
);

// ============================================================================
// INVENTORY
// ============================================================================

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unit: varchar("unit", { length: 50 }), // e.g., "towels", "rolls", "bottles"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    propertyIdx: index("inventory_items_property_id_idx").on(table.propertyId),
  })
);

// ============================================================================
// JOBS
// ============================================================================

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    propertyId: text("property_id").notNull(),
    managerId: text("manager_id").notNull(),
    cleanerId: text("cleaner_id"), // Assigned cleaner (nullable if not yet assigned)
    status: jobStatusEnum("status").notNull().default("available"),
    scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
    guestCount: integer("guest_count"),
    hasPets: boolean("has_pets").default(false),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    instructions: text("instructions"), // Manager's job-specific instructions
    startTime: timestamp("start_time", { withTimezone: true }), // When first photo uploaded
    endTime: timestamp("end_time", { withTimezone: true }), // When Done pressed
    gpsStartLat: decimal("gps_start_lat", { precision: 10, scale: 8 }),
    gpsStartLng: decimal("gps_start_lng", { precision: 11, scale: 8 }),
    gpsEndLat: decimal("gps_end_lat", { precision: 10, scale: 8 }),
    gpsEndLng: decimal("gps_end_lng", { precision: 11, scale: 8 }),
    invoiceId: text("invoice_id"), // Link to invoice (after completion)
    accessDenied: boolean("access_denied").default(false), // Guest present, job not started
    payTypeOverride: payTypeEnum("pay_type_override"), // Manager override for this job's pay type (nullable = use cleaner's default)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("jobs_company_id_idx").on(table.companyId),
    propertyIdx: index("jobs_property_id_idx").on(table.propertyId),
    managerIdx: index("jobs_manager_id_idx").on(table.managerId),
    cleanerIdx: index("jobs_cleaner_id_idx").on(table.cleanerId),
    statusIdx: index("jobs_status_idx").on(table.status),
    scheduledDateIdx: index("jobs_scheduled_date_idx").on(table.scheduledDate),
  })
);

// ============================================================================
// JOB INVENTORY TRACKING
// ============================================================================

export const jobInventoryLog = pgTable(
  "job_inventory_log",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    inventoryItemId: text("inventory_item_id").notNull(),
    isUsed: boolean("is_used").notNull().default(false), // true = used/missing, false = in stock
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("job_inventory_log_job_id_idx").on(table.jobId),
    inventoryIdx: index("job_inventory_log_inventory_item_id_idx").on(table.inventoryItemId),
  })
);

// ============================================================================
// PHOTOS
// ============================================================================

export const photos = pgTable(
  "photos",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    uri: text("uri").notNull(), // Cloud URL (S3)
    room: varchar("room", { length: 100 }), // e.g., "Master Bedroom", "Kitchen"
    isRequired: boolean("is_required").default(false),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("photos_job_id_idx").on(table.jobId),
  })
);

// ============================================================================
// DAMAGES
// ============================================================================

export const damages = pgTable(
  "damages",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    description: text("description").notNull(),
    severity: damageSeverityEnum("severity").notNull().default("minor"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("damages_job_id_idx").on(table.jobId),
  })
);

export const damagePhotos = pgTable(
  "damage_photos",
  {
    id: text("id").primaryKey(),
    damageId: text("damage_id").notNull(),
    uri: text("uri").notNull(), // Cloud URL (S3)
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    damageIdx: index("damage_photos_damage_id_idx").on(table.damageId),
  })
);

// ============================================================================
// CHAT
// ============================================================================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    senderId: text("sender_id").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("chat_messages_job_id_idx").on(table.jobId),
    senderIdx: index("chat_messages_sender_id_idx").on(table.senderId),
  })
);

// ============================================================================
// INVOICES
// ============================================================================

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    cleanerId: text("cleaner_id").notNull(),
    status: invoiceStatusEnum("status").notNull().default("open"),
    invoiceCycle: invoiceCycleEnum("invoice_cycle").notNull().default("bi_weekly"),
    payType: payTypeEnum("pay_type").notNull().default("per_job"), // Immutable for this pay cycle (set at invoice creation)
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    pdfUrl: text("pdf_url"), // Generated PDF URL
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("invoices_company_id_idx").on(table.companyId),
    cleanerIdx: index("invoices_cleaner_id_idx").on(table.cleanerId),
    statusIdx: index("invoices_status_idx").on(table.status),
  })
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    jobId: text("job_id").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    adjustedPrice: decimal("adjusted_price", { precision: 10, scale: 2 }), // Manager override
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("invoice_items_invoice_id_idx").on(table.invoiceId),
    jobIdx: index("invoice_items_job_id_idx").on(table.jobId),
  })
);

// ============================================================================
// GUESTY SYNC LOG
// ============================================================================

export const guestySyncLog = pgTable(
  "guesty_sync_log",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).notNull().defaultNow(),
    bookingsCount: integer("bookings_count").default(0),
    jobsCreatedCount: integer("jobs_created_count").default(0),
    jobsUpdatedCount: integer("jobs_updated_count").default(0),
    syncStatus: varchar("sync_status", { length: 50 }).default("success"), // "success", "error", "pending"
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("guesty_sync_log_company_id_idx").on(table.companyId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  properties: many(properties),
  jobs: many(jobs),
  invoices: many(invoices),
  chatMessages: many(chatMessages),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
}));

export const propertiesRelations = relations(properties, ({ many, one }) => ({
  jobs: many(jobs),
  inventoryItems: many(inventoryItems),
  manager: one(users, {
    fields: [properties.managerId],
    references: [users.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ many, one }) => ({
  property: one(properties, {
    fields: [inventoryItems.propertyId],
    references: [properties.id],
  }),
  jobLogs: many(jobInventoryLog),
}));

export const jobsRelations = relations(jobs, ({ many, one }) => ({
  property: one(properties, {
    fields: [jobs.propertyId],
    references: [properties.id],
  }),
  manager: one(users, {
    fields: [jobs.managerId],
    references: [users.id],
  }),
  cleaner: one(users, {
    fields: [jobs.cleanerId],
    references: [users.id],
  }),
  photos: many(photos),
  damages: many(damages),
  inventoryLogs: many(jobInventoryLog),
  chatMessages: many(chatMessages),
  invoiceItems: many(invoiceItems),
}));

export const jobInventoryLogRelations = relations(jobInventoryLog, ({ one }) => ({
  job: one(jobs, {
    fields: [jobInventoryLog.jobId],
    references: [jobs.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [jobInventoryLog.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  job: one(jobs, {
    fields: [photos.jobId],
    references: [jobs.id],
  }),
}));

export const damagesRelations = relations(damages, ({ many, one }) => ({
  job: one(jobs, {
    fields: [damages.jobId],
    references: [jobs.id],
  }),
  photos: many(damagePhotos),
}));

export const damagePhotosRelations = relations(damagePhotos, ({ one }) => ({
  damage: one(damages, {
    fields: [damagePhotos.damageId],
    references: [damages.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  job: one(jobs, {
    fields: [chatMessages.jobId],
    references: [jobs.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  cleaner: one(users, {
    fields: [invoices.cleanerId],
    references: [users.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  job: one(jobs, {
    fields: [invoiceItems.jobId],
    references: [jobs.id],
  }),
}));

export const guestySyncLogRelations = relations(guestySyncLog, ({ one }) => ({
  // No direct relations needed
}));
