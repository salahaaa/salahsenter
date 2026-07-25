import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "pending", "suspended", "inactive", "deleted"]);
export const roleScopeEnum = pgEnum("role_scope", ["system", "store"]);
export const applicationStatusEnum = pgEnum("merchant_application_status", [
  "new",
  "pending",
  "under_review",
  "waiting_for_data",
  "documents_required",
  "pre_approved",
  "contract_created",
  "contract_signed",
  "waiting_final_approval",
  "approved",
  "active",
  "rejected"
]);
export const storeStatusEnum = pgEnum("store_status", ["active", "pending", "suspended", "closed", "frozen"]);
export const productTypeEnum = pgEnum("product_type", ["simple", "variable"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "review", "active", "paused", "inactive", "archived"]);
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "add",
  "deduct",
  "adjust",
  "reserve",
  "release",
  "return"
]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);
export const contentLevelEnum = pgEnum("content_level", ["marketplace", "store"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "scheduled", "active", "expired", "disabled"]);
export const contractStatusEnum = pgEnum("contract_status", ["draft", "pending_signature", "pending_approval", "active", "near_expiry", "expired", "grace", "renewal_requested", "frozen", "terminated", "renewed"]);
export const mediaTypeEnum = pgEnum("media_type", ["cover", "logo", "intro", "gallery", "video", "banner", "icon"]);
export const coverageLevelEnum = pgEnum("coverage_level", ["country", "governorate", "city", "district"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "sms", "push"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "approve", "reject", "login", "logout", "status_change"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    /** Optional for customers; mandatory for newly created employees. Stored lowercase. */
    username: varchar("username", { length: 64 }),
    avatarUrl: text("avatar_url"),
    phone: varchar("phone", { length: 40 }),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    /** Explicitly marked QA identities can never unlock owner-sensitive controls. */
    isTestAccount: boolean("is_test_account").notNull().default(false),
    status: userStatusEnum("status").notNull().default("pending"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_unique").on(table.email),
    usernameIdx: uniqueIndex("users_username_unique").on(table.username).where(sql`${table.username} is not null`),
    phoneIdx: index("users_phone_idx").on(table.phone),
    statusIdx: index("users_status_idx").on(table.status),
    testAccountIdx: index("users_test_account_idx").on(table.isTestAccount, table.status)
  })
);


/** Singleton verifier for the owner-only sensitive-control password. Only a bcrypt hash is stored. */
export const platformSensitiveControlSettings = pgTable(
  "platform_sensitive_control_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passwordHash: text("password_hash").notNull(),
    initializedBy: uuid("initialized_by").references(() => users.id, { onDelete: "set null" }),
    initializedAt: timestamp("initialized_at", { withTimezone: true }).notNull().defaultNow(),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  }
);

/** Short-lived unlock sessions separate from normal admin authentication. */
export const platformSensitiveControlSessions = pgTable(
  "platform_sensitive_control_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenUnique: uniqueIndex("platform_sensitive_control_sessions_token_unique").on(table.tokenHash),
    ownerExpiryIdx: index("platform_sensitive_control_sessions_owner_expiry_idx").on(table.ownerUserId, table.expiresAt)
  })
);

/** Two independent owner logins give recovery from a compromised admin email. */
export const platformOwnerAccounts = pgTable(
  "platform_owner_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slot: integer("slot").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    emailSnapshot: varchar("email_snapshot", { length: 255 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slotUnique: uniqueIndex("platform_owner_accounts_slot_unique").on(table.slot),
    userUnique: uniqueIndex("platform_owner_accounts_user_unique").on(table.userId)
  })
);

/** Audit/recovery record for the one-time post-purge owner bootstrap. */
export const prelaunchResetRuns = pgTable(
  "prelaunch_reset_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    initiatedBy: uuid("initiated_by").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 40 }).notNull().default("bootstrap_pending"),
    purgeSummary: jsonb("purge_summary").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    bootstrapTokenHash: varchar("bootstrap_token_hash", { length: 128 }).notNull(),
    bootstrapExpiresAt: timestamp("bootstrap_expires_at", { withTimezone: true }).notNull(),
    bootstrapConsumedAt: timestamp("bootstrap_consumed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenUnique: uniqueIndex("prelaunch_reset_runs_token_unique").on(table.bootstrapTokenHash),
    statusExpiryIdx: index("prelaunch_reset_runs_status_expiry_idx").on(table.status, table.bootstrapExpiresAt)
  })
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull().default("العنوان الرئيسي"),
    recipientName: varchar("recipient_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 60 }).notNull(),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "set null" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "set null" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    districtId: uuid("district_id").references(() => districts.id, { onDelete: "set null" }),
    cityText: varchar("city_text", { length: 160 }),
    districtText: varchar("district_text", { length: 160 }),
    addressLine: text("address_line").notNull(),
    landmark: text("landmark"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("customer_addresses_user_idx").on(table.userId, table.isDefault),
    cityIdx: index("customer_addresses_city_idx").on(table.cityId)
  })
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash"),
    deviceId: varchar("device_id", { length: 120 }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("user_sessions_user_idx").on(table.userId, table.revokedAt),
    tokenIdx: uniqueIndex("user_sessions_token_hash_unique").on(table.tokenHash),
    expiryIdx: index("user_sessions_expiry_idx").on(table.expiresAt, table.revokedAt),
    deviceIdx: index("user_sessions_device_idx").on(table.userId, table.deviceId)
  })
);

export const userMfaSettings = pgTable(
  "user_mfa_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    totpSecret: text("totp_secret"),
    isTotpEnabled: boolean("is_totp_enabled").notNull().default(false),
    backupCodeHashes: jsonb("backup_code_hashes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    recoveryCodeHashes: jsonb("recovery_code_hashes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("user_mfa_settings_user_unique").on(table.userId),
    enabledIdx: index("user_mfa_settings_enabled_idx").on(table.isTotpEnabled)
  })
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    channel: varchar("channel", { length: 40 }).notNull().default("email"),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("password_reset_tokens_user_idx").on(table.userId),
    tokenIdx: uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    expiresIdx: index("password_reset_tokens_expires_idx").on(table.expiresAt, table.usedAt)
  })
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 80 }).notNull(),
    key: varchar("key", { length: 180 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    requestHash: text("request_hash").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("processing"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    statusCode: integer("status_code"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    scopeKeyIdx: uniqueIndex("idempotency_keys_scope_key_unique").on(table.scope, table.key),
    userIdx: index("idempotency_keys_user_idx").on(table.userId, table.createdAt),
    expiryIdx: index("idempotency_keys_expiry_idx").on(table.expiresAt),
    statusIdx: index("idempotency_keys_status_idx").on(table.status, table.lockedUntil)
  })
);

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: varchar("queue", { length: 80 }).notNull().default("default"),
    type: varchar("type", { length: 120 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    deadLetterReason: text("dead_letter_reason"),
    lastError: text("last_error"),
    dedupeKey: varchar("dedupe_key", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    queueStatusIdx: index("background_jobs_queue_status_idx").on(table.queue, table.status, table.availableAt),
    typeIdx: index("background_jobs_type_idx").on(table.type),
    lockedIdx: index("background_jobs_locked_idx").on(table.status, table.lockedUntil),
    dedupeIdx: uniqueIndex("background_jobs_queue_dedupe_unique").on(table.queue, table.dedupeKey)
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    scope: roleScopeEnum("scope").notNull().default("system"),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("roles_code_unique").on(table.code),
    scopeIdx: index("roles_scope_idx").on(table.scope)
  })
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 140 }).notNull(),
    code: varchar("code", { length: 160 }).notNull(),
    group: varchar("group", { length: 80 }).notNull().default("general"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("permissions_code_unique").on(table.code),
    groupIdx: index("permissions_group_idx").on(table.group)
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] })
  })
);

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    iso2: varchar("iso2", { length: 2 }),
    phoneCode: varchar("phone_code", { length: 12 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    nameIdx: uniqueIndex("countries_name_unique").on(table.name),
    activeIdx: index("countries_active_idx").on(table.isActive)
  })
);

export const governorates = pgTable(
  "governorates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryId: uuid("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    countryIdx: index("governorates_country_idx").on(table.countryId),
    uniquePerCountry: uniqueIndex("governorates_country_name_unique").on(table.countryId, table.name)
  })
);

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    governorateId: uuid("governorate_id")
      .notNull()
      .references(() => governorates.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    governorateIdx: index("cities_governorate_idx").on(table.governorateId),
    uniquePerGovernorate: uniqueIndex("cities_governorate_name_unique").on(table.governorateId, table.name)
  })
);

export const districts = pgTable(
  "districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    cityIdx: index("districts_city_idx").on(table.cityId),
    uniquePerCity: uniqueIndex("districts_city_name_unique").on(table.cityId, table.name)
  })
);

export const wings = pgTable(
  "wings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    iconUrl: text("icon_url"),
    heroImageUrl: text("hero_image_url"),
    mobileImageUrl: text("mobile_image_url"),
    desktopImageUrl: text("desktop_image_url"),
    description: text("description"),
    /** The one catalogue template represented by this public mall wing. */
    activityTemplateKey: varchar("activity_template_key", { length: 160 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("wings_slug_unique").on(table.slug),
    activeIdx: index("wings_active_idx").on(table.isActive),
    activityTemplateIdx: index("wings_activity_template_idx").on(table.activityTemplateKey)
  })
);

export const defaultActivityMedia = pgTable(
  "default_activity_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wingId: uuid("wing_id")
      .notNull()
      .references(() => wings.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 200 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    wingIdx: index("default_activity_media_wing_idx").on(table.wingId),
    typeIdx: index("default_activity_media_type_idx").on(table.mediaType)
  })
);

export const merchantApplications = pgTable(
  "merchant_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantUserId: uuid("applicant_user_id").references(() => users.id, { onDelete: "set null" }),
    applicationType: varchar("application_type", { length: 40 }).notNull().default("initial_store"),
    identityReusedFromApplicationId: uuid("identity_reused_from_application_id").references((): AnyPgColumn => merchantApplications.id, { onDelete: "set null" }),
    applicantName: varchar("applicant_name", { length: 160 }).notNull(),
    applicantEmail: varchar("applicant_email", { length: 255 }).notNull(),
    applicantPhone: varchar("applicant_phone", { length: 40 }),
    storeName: varchar("store_name", { length: 160 }).notNull(),
    businessActivity: varchar("business_activity", { length: 160 }).notNull(),
    /** Sector/template deliberately selected by the merchant during onboarding. */
    activityTemplateKey: varchar("activity_template_key", { length: 160 }),
    storeCommerceType: varchar("store_commerce_type", { length: 40 }).notNull().default("ONLINE_SALES"),
    wingId: uuid("wing_id").references(() => wings.id, { onDelete: "set null" }),
    description: text("description"),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "set null" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "set null" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    districtId: uuid("district_id").references(() => districts.id, { onDelete: "set null" }),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    status: applicationStatusEnum("status").notNull().default("new"),
    adminNote: text("admin_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdStoreId: uuid("created_store_id"),
    contractTitle: varchar("contract_title", { length: 180 }).notNull().default("عقد فتح متجر إلكتروني"),
    contractVersion: varchar("contract_version", { length: 40 }).notNull().default("1.0"),
    onboardingContractNumber: varchar("onboarding_contract_number", { length: 60 }),
    contractBody: text("contract_body"),
    contractStartAt: timestamp("contract_start_at", { withTimezone: true }),
    contractEndAt: timestamp("contract_end_at", { withTimezone: true }),
    contractDurationDays: integer("contract_duration_days").notNull().default(365),
    /** Commercial model selected by admin before contract generation. */
    revenueModel: varchar("revenue_model", { length: 40 }).notNull().default("monthly_rent"),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull().default("0"),
    commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    dueDays: integer("due_days").notNull().default(7),
    graceDays: integer("grace_days").notNull().default(7),
    subscriptionFee: numeric("subscription_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    contractAccessTokenHash: text("contract_access_token_hash"),
    contractAcceptedAt: timestamp("contract_accepted_at", { withTimezone: true }),
    contractSignatureDataUrl: text("contract_signature_data_url"),
    signedContractSnapshot: jsonb("signed_contract_snapshot").$type<Record<string, unknown>>(),
    finalApprovedBy: uuid("final_approved_by").references(() => users.id, { onDelete: "set null" }),
    finalApprovedAt: timestamp("final_approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("merchant_applications_status_idx").on(table.status),
    emailIdx: index("merchant_applications_email_idx").on(table.applicantEmail),
    locationIdx: index("merchant_applications_location_idx").on(table.countryId, table.governorateId, table.cityId),
    userTypeStatusIdx: index("merchant_applications_user_type_status_idx").on(table.applicantUserId, table.applicationType, table.status, table.createdAt),
    identityReuseIdx: index("merchant_applications_identity_reuse_idx").on(table.identityReusedFromApplicationId),
    activityTemplateIdx: index("merchant_applications_activity_template_idx").on(table.activityTemplateKey)
  })
);


export const merchantApplicationDocuments = pgTable(
  "merchant_application_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => merchantApplications.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }),
    fileUrl: text("file_url").notNull(),
    fileName: varchar("file_name", { length: 255 }),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    note: text("note"),
    requirementId: uuid("requirement_id"),
    mediaAssetId: uuid("media_asset_id"),
    storageKey: text("storage_key"),
    mimeType: varchar("mime_type", { length: 120 }),
    sha256: varchar("sha256", { length: 128 }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    applicationIdx: index("merchant_application_documents_application_idx").on(table.applicationId),
    typeIdx: index("merchant_application_documents_type_idx").on(table.documentType),
    statusIdx: index("merchant_application_documents_status_idx").on(table.status),
    requirementIdx: index("merchant_application_documents_requirement_idx").on(table.requirementId)
  })
);

/** Required-document policy per application. A document upload alone never means approval. */
export const merchantApplicationDocumentRequirements = pgTable(
  "merchant_application_document_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => merchantApplications.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    status: varchar("status", { length: 40 }).notNull().default("requested"),
    documentId: uuid("document_id").references(() => merchantApplicationDocuments.id, { onDelete: "set null" }),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    applicationIdx: index("merchant_application_document_requirements_application_idx").on(table.applicationId, table.status),
    uniqueType: uniqueIndex("merchant_application_document_requirements_type_unique").on(table.applicationId, table.documentType)
  })
);


export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    applicationId: uuid("application_id").references(() => merchantApplications.id, { onDelete: "set null" }),
    merchantNumber: varchar("merchant_number", { length: 40 }).notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("merchants_user_unique").on(table.userId),
    numberIdx: uniqueIndex("merchants_number_unique").on(table.merchantNumber),
    applicationIdx: index("merchants_application_idx").on(table.applicationId),
    statusIdx: index("merchants_status_idx").on(table.status)
  })
);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    merchantProfileId: uuid("merchant_profile_id").references(() => merchants.id, { onDelete: "set null" }),
    storeNumber: varchar("store_number", { length: 40 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 190 }).notNull(),
    description: text("description"),
    /** Copied from the approved application; scopes merchant sector suggestions. */
    activityTemplateKey: varchar("activity_template_key", { length: 160 }),
    storeCommerceType: varchar("store_commerce_type", { length: 40 }).notNull().default("ONLINE_SALES"),
    operationStatus: varchar("operation_status", { length: 40 }).notNull().default("OPEN"),
    operationNote: text("operation_note"),
    businessHours: jsonb("business_hours").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    operationStatusUpdatedAt: timestamp("operation_status_updated_at", { withTimezone: true }),
    status: storeStatusEnum("status").notNull().default("pending"),
    primaryWingId: uuid("primary_wing_id").references(() => wings.id, { onDelete: "set null" }),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "set null" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "set null" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    districtId: uuid("district_id").references(() => districts.id, { onDelete: "set null" }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    coverImageUrl: text("cover_image_url"),
    logoUrl: text("logo_url"),
    introImageUrl: text("intro_image_url"),
    videoUrl: text("video_url"),
    ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    orderCount: integer("order_count").notNull().default(0),
    salesTotal: numeric("sales_total", { precision: 14, scale: 2 }).notNull().default("0"),
    profileCompleteness: integer("profile_completeness").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("stores_slug_unique").on(table.slug),
    storeNumberIdx: uniqueIndex("stores_store_number_unique").on(table.storeNumber),
    merchantIdx: index("stores_merchant_idx").on(table.merchantId),
    merchantProfileIdx: index("stores_merchant_profile_idx").on(table.merchantProfileId),
    activityTemplateIdx: index("stores_activity_template_idx").on(table.activityTemplateKey),
    wingIdx: index("stores_primary_wing_idx").on(table.primaryWingId),
    locationIdx: index("stores_location_idx").on(table.countryId, table.governorateId, table.cityId),
    rankingIdx: index("stores_ranking_idx").on(table.ratingAverage, table.orderCount, table.salesTotal)
  })
);

export const storeWings = pgTable(
  "store_wings",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    wingId: uuid("wing_id")
      .notNull()
      .references(() => wings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.storeId, table.wingId] })
  })
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    // storeId is null for system-level roles and filled for store-scoped roles/employees.
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueAssignment: uniqueIndex("user_roles_assignment_unique").on(table.userId, table.roleId, table.storeId),
    userIdx: index("user_roles_user_idx").on(table.userId),
    storeIdx: index("user_roles_store_idx").on(table.storeId)
  })
);

/**
 * Direct per-user exceptions layered over role_permissions. A grant adds a
 * capability; a deny removes one inherited from a role. storeId is null only
 * for platform permissions and non-null for store-scoped employee permissions.
 */
export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    effect: varchar("effect", { length: 8 }).$type<"grant" | "deny">().notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    systemUnique: uniqueIndex("user_permissions_system_unique").on(table.userId, table.permissionId).where(sql`${table.storeId} is null`),
    storeUnique: uniqueIndex("user_permissions_store_unique").on(table.userId, table.permissionId, table.storeId).where(sql`${table.storeId} is not null`),
    userScopeIdx: index("user_permissions_user_scope_idx").on(table.userId, table.storeId),
    permissionIdx: index("user_permissions_permission_idx").on(table.permissionId)
  })
);

/** Account can be active while public storefront remains setup_pending until launch review. */
export const storeLaunchReadiness = pgTable(
  "store_launch_readiness",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => merchantApplications.id, { onDelete: "set null" }),
    status: varchar("status", { length: 40 }).notNull().default("setup_pending"),
    checks: jsonb("checks").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeUnique: uniqueIndex("store_launch_readiness_store_unique").on(table.storeId),
    statusIdx: index("store_launch_readiness_status_idx").on(table.status, table.submittedAt)
  })
);

export const storeEmployees = pgTable(
  "store_employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    groupRoleId: uuid("group_role_id").references(() => roles.id, { onDelete: "set null" }),
    employeeCode: varchar("employee_code", { length: 80 }),
    nationalId: varchar("national_id", { length: 80 }),
    jobTitle: varchar("job_title", { length: 140 }),
    address: text("address"),
    notes: text("notes"),
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueEmployee: uniqueIndex("store_employees_store_user_unique").on(table.storeId, table.userId),
    uniqueEmployeeCode: uniqueIndex("store_employees_store_code_unique").on(table.storeId, table.employeeCode),
    storeIdx: index("store_employees_store_idx").on(table.storeId),
    roleIdx: index("store_employees_role_idx").on(table.roleId),
    groupRoleIdx: index("store_employees_group_role_idx").on(table.groupRoleId),
    statusIdx: index("store_employees_status_idx").on(table.status)
  })
);

export const platformEmployees = pgTable(
  "platform_employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupRoleId: uuid("group_role_id").references(() => roles.id, { onDelete: "set null" }),
    directRoleId: uuid("direct_role_id").references(() => roles.id, { onDelete: "set null" }),
    employeeNumber: varchar("employee_number", { length: 80 }).notNull(),
    jobTitle: varchar("job_title", { length: 140 }),
    departmentGroup: varchar("department_group", { length: 140 }),
    nationalId: varchar("national_id", { length: 80 }),
    address: text("address"),
    notes: text("notes"),
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("platform_employees_user_unique").on(table.userId),
    numberIdx: uniqueIndex("platform_employees_number_unique").on(table.employeeNumber),
    groupRoleIdx: index("platform_employees_group_role_idx").on(table.groupRoleId),
    directRoleIdx: index("platform_employees_direct_role_idx").on(table.directRoleId),
    statusIdx: index("platform_employees_status_idx").on(table.status)
  })
);

export const storeCoverage = pgTable(
  "store_coverage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    coverageLevel: coverageLevelEnum("coverage_level").notNull(),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "cascade" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "cascade" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "cascade" }),
    districtId: uuid("district_id").references(() => districts.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("store_coverage_store_idx").on(table.storeId),
    locationIdx: index("store_coverage_location_idx").on(table.countryId, table.governorateId, table.cityId, table.districtId)
  })
);

/** Durable references for generated signed contract PDF and document-manifest PDF. */
export const merchantApplicationArchives = pgTable(
  "merchant_application_archives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => merchantApplications.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 80 }).notNull(),
    version: varchar("version", { length: 80 }).notNull().default("1.0"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    url: text("url"),
    storageKey: text("storage_key"),
    sha256: varchar("sha256", { length: 128 }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    error: text("error"),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    applicationKindVersionUnique: uniqueIndex("merchant_application_archives_kind_version_unique").on(table.applicationId, table.kind, table.version),
    statusIdx: index("merchant_application_archives_status_idx").on(table.status, table.updatedAt)
  })
);

export const storeMedia = pgTable(
  "store_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 200 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("store_media_store_idx").on(table.storeId),
    typeIdx: index("store_media_type_idx").on(table.mediaType)
  })
);


export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull().default("local"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    sizeBytes: integer("size_bytes").notNull().default(0),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    ownerIdx: index("media_assets_owner_idx").on(table.ownerId),
    storeIdx: index("media_assets_store_idx").on(table.storeId),
    providerIdx: index("media_assets_provider_idx").on(table.provider)
  })
);

export const merchantActivityTemplateCatalog = pgTable(
  "merchant_activity_template_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 120 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    sector: varchar("sector", { length: 120 }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeUnique: uniqueIndex("merchant_activity_template_catalog_code_unique").on(table.code),
    statusSectorIdx: index("merchant_activity_template_catalog_status_sector_idx").on(table.status, table.sector, table.updatedAt)
  })
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    code: varchar("code", { length: 80 }),
    codeMode: varchar("code_mode", { length: 20 }).notNull().default("auto"),
    level: integer("level").notNull().default(0),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("categories_store_idx").on(table.storeId),
    codeIdx: index("categories_code_idx").on(table.storeId, table.code),
    parentIdx: index("categories_parent_idx").on(table.parentId),
    uniqueStoreSlug: uniqueIndex("categories_store_slug_unique").on(table.storeId, table.slug)
  })
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    symbol: varchar("symbol", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueStoreName: uniqueIndex("units_store_name_unique").on(table.storeId, table.name)
  })
);

export const sizes = pgTable(
  "sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueStoreName: uniqueIndex("sizes_store_name_unique").on(table.storeId, table.name)
  })
);

export const colors = pgTable(
  "colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    hexCode: varchar("hex_code", { length: 12 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueStoreName: uniqueIndex("colors_store_name_unique").on(table.storeId, table.name)
  })
);


export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    displayType: varchar("display_type", { length: 40 }).notNull().default("button"),
    isVariantOption: boolean("is_variant_option").notNull().default(true),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("product_attributes_store_idx").on(table.storeId),
    codeIdx: uniqueIndex("product_attributes_store_code_unique").on(table.storeId, table.code)
  })
);

export const productAttributeValues = pgTable(
  "product_attribute_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => productAttributes.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 160 }).notNull(),
    code: varchar("code", { length: 120 }),
    colorHex: varchar("color_hex", { length: 12 }),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    attributeIdx: index("product_attribute_values_attribute_idx").on(table.attributeId),
    codeIdx: index("product_attribute_values_code_idx").on(table.attributeId, table.code)
  })
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    englishName: varchar("english_name", { length: 180 }),
    slug: varchar("slug", { length: 220 }).notNull(),
    productCode: varchar("product_code", { length: 120 }),
    codeMode: varchar("code_mode", { length: 20 }).notNull().default("auto"),
    barcode: varchar("barcode", { length: 120 }),
    shortDescription: text("short_description"),
    description: text("description"),
    brand: varchar("brand", { length: 160 }),
    originCountry: varchar("origin_country", { length: 120 }),
    warranty: varchar("warranty", { length: 160 }),
    youtubeUrl: text("youtube_url"),
    type: productTypeEnum("type").notNull().default("simple"),
    status: productStatusEnum("status").notNull().default("draft"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    mainImageUrl: text("main_image_url"),
    images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    specifications: jsonb("specifications").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    pricingMode: varchar("pricing_mode", { length: 40 }).notNull().default("independent"),
    inventoryMode: varchar("inventory_mode", { length: 40 }).notNull().default("variant"),
    productCommerceType: varchar("product_commerce_type", { length: 40 }).notNull().default("ONLINE_SALES"),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    showcaseStatus: varchar("showcase_status", { length: 40 }).notNull().default("AVAILABLE"),
    showcaseSoldAt: timestamp("showcase_sold_at", { withTimezone: true }),
    showcaseNote: text("showcase_note"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    unpublishAt: timestamp("unpublish_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    isPromoted: boolean("is_promoted").notNull().default(false),
    promotionStart: timestamp("promotion_start", { withTimezone: true }),
    promotionEnd: timestamp("promotion_end", { withTimezone: true }),
    promotionPackage: varchar("promotion_package", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueStoreSlug: uniqueIndex("products_store_slug_unique").on(table.storeId, table.slug),
    storeIdx: index("products_store_idx").on(table.storeId),
    codeIdx: index("products_code_idx").on(table.storeId, table.productCode),
    barcodeIdx: index("products_barcode_idx").on(table.barcode),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    lifecycleIdx: index("products_lifecycle_idx").on(table.status, table.publishAt, table.unpublishAt),
    rankingIdx: index("products_ranking_idx").on(table.soldCount, table.viewCount, table.ratingAverage)
  })
);

export const productLifecycleEvents = pgTable(
  "product_lifecycle_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 40 }),
    toStatus: varchar("to_status", { length: 40 }).notNull(),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_lifecycle_events_product_idx").on(table.productId, table.createdAt),
    storeIdx: index("product_lifecycle_events_store_idx").on(table.storeId, table.createdAt)
  })
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 120 }).notNull(),
    barcode: varchar("barcode", { length: 120 }),
    title: varchar("title", { length: 180 }),
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
    sizeId: uuid("size_id").references(() => sizes.id, { onDelete: "set null" }),
    colorId: uuid("color_id").references(() => colors.id, { onDelete: "set null" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    /** Weighted average and latest purchase cost; never exposed to storefronts. */
    averageCost: numeric("average_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    lastCost: numeric("last_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    priceAdjustment: numeric("price_adjustment", { precision: 12, scale: 2 }).notNull().default("0"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    imageUrl: text("image_url"),
    images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_variants_product_idx").on(table.productId),
    skuIdx: uniqueIndex("product_variants_product_sku_unique").on(table.productId, table.sku),
    barcodeIdx: index("product_variants_barcode_idx").on(table.barcode),
    lowStockIdx: index("product_variants_low_stock_idx").on(table.stockQuantity, table.lowStockThreshold)
  })
);


export const variantChangeLogs = pgTable(
  "variant_change_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    changeType: varchar("change_type", { length: 60 }).notNull(),
    beforeData: jsonb("before_data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    afterData: jsonb("after_data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    variantIdx: index("variant_change_logs_variant_idx").on(table.variantId, table.createdAt),
    productIdx: index("variant_change_logs_product_idx").on(table.productId, table.createdAt),
    storeIdx: index("variant_change_logs_store_idx").on(table.storeId, table.createdAt)
  })
);

export const shoppingCarts = pgTable(
  "shopping_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userStatusIdx: index("shopping_carts_user_status_idx").on(table.userId, table.status),
    updatedIdx: index("shopping_carts_updated_idx").on(table.updatedAt)
  })
);

export const shoppingCartItems = pgTable(
  "shopping_cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => shoppingCarts.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    cartVariantUnique: uniqueIndex("shopping_cart_items_cart_variant_unique").on(table.cartId, table.variantId),
    cartIdx: index("shopping_cart_items_cart_idx").on(table.cartId),
    storeIdx: index("shopping_cart_items_store_idx").on(table.storeId),
    productIdx: index("shopping_cart_items_product_idx").on(table.productId)
  })
);

export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userProductUnique: uniqueIndex("wishlists_user_product_unique").on(table.userId, table.productId),
    userIdx: index("wishlists_user_idx").on(table.userId, table.createdAt),
    productIdx: index("wishlists_product_idx").on(table.productId)
  })
);

export const productVariantAttributeValues = pgTable(
  "product_variant_attribute_values",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => productAttributes.id, { onDelete: "cascade" }),
    valueId: uuid("value_id")
      .notNull()
      .references(() => productAttributeValues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.variantId, table.attributeId] }),
    valueIdx: index("product_variant_attribute_values_value_idx").on(table.valueId)
  })
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    attributeValueId: uuid("attribute_value_id").references(() => productAttributeValues.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 200 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_images_product_idx").on(table.productId),
    variantIdx: index("product_images_variant_idx").on(table.variantId),
    attributeValueIdx: index("product_images_attribute_value_idx").on(table.attributeValueId)
  })
);

export const productSpecifications = pgTable(
  "product_specifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    value: text("value").notNull(),
    groupName: varchar("group_name", { length: 140 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_specifications_product_idx").on(table.productId)
  })
);

export const productQuestions = pgTable(
  "product_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_questions_product_idx").on(table.productId),
    approvedIdx: index("product_questions_approved_idx").on(table.isApproved)
  })
);

export const productAnswers = pgTable(
  "product_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => productQuestions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    answer: text("answer").notNull(),
    isApproved: boolean("is_approved").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    questionIdx: index("product_answers_question_idx").on(table.questionId)
  })
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    beforeQuantity: integer("before_quantity").notNull(),
    afterQuantity: integer("after_quantity").notNull(),
    reason: text("reason"),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: uuid("reference_id"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("inventory_movements_store_idx").on(table.storeId),
    variantIdx: index("inventory_movements_variant_idx").on(table.variantId),
    referenceIdx: index("inventory_movements_reference_idx").on(table.referenceType, table.referenceId),
    createdAtIdx: index("inventory_movements_created_at_idx").on(table.createdAt)
  })
);


export const inventoryStockCounts = pgTable(
  "inventory_stock_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    title: varchar("title", { length: 180 }).notNull().default("جرد دوري"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    appliedBy: uuid("applied_by").references(() => users.id, { onDelete: "set null" }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("inventory_stock_counts_store_idx").on(table.storeId, table.status, table.createdAt)
  })
);

export const inventoryStockCountLines = pgTable(
  "inventory_stock_count_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockCountId: uuid("stock_count_id").notNull().references(() => inventoryStockCounts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    expectedQuantity: integer("expected_quantity").notNull(),
    countedQuantity: integer("counted_quantity"),
    differenceQuantity: integer("difference_quantity"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    countVariantIdx: uniqueIndex("inventory_stock_count_lines_count_variant_unique").on(table.stockCountId, table.variantId),
    countIdx: index("inventory_stock_count_lines_count_idx").on(table.stockCountId)
  })
);

/** Supplier, cost, transfer, batch and sector capability foundations for Product OS. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }),
    name: varchar("name", { length: 180 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),
    phone: varchar("phone", { length: 60 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    notes: text("notes"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("suppliers_store_idx").on(table.storeId, table.status),
    storeCodeUnique: uniqueIndex("suppliers_store_code_unique").on(table.storeId, table.code)
  })
);

export const productSuppliers = pgTable(
  "product_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    supplierSku: varchar("supplier_sku", { length: 160 }),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    leadTimeDays: integer("lead_time_days"),
    isPreferred: boolean("is_preferred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_suppliers_product_idx").on(table.productId, table.variantId),
    supplierIdx: index("product_suppliers_supplier_idx").on(table.supplierId),
    uniqueVariantLink: uniqueIndex("product_suppliers_unique_variant").on(table.supplierId, table.productId, table.variantId).where(sql`${table.variantId} is not null`),
    uniqueProductLink: uniqueIndex("product_suppliers_unique_product").on(table.supplierId, table.productId).where(sql`${table.variantId} is null`)
  })
);

export const inventoryCostReceipts = pgTable(
  "inventory_cost_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    previousAverageCost: numeric("previous_average_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    resultingAverageCost: numeric("resulting_average_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    referenceNumber: varchar("reference_number", { length: 140 }),
    note: text("note"),
    receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("inventory_cost_receipts_store_idx").on(table.storeId, table.receivedAt),
    variantIdx: index("inventory_cost_receipts_variant_idx").on(table.variantId, table.receivedAt),
    supplierIdx: index("inventory_cost_receipts_supplier_idx").on(table.supplierId)
  })
);

export const inventoryTransfers = pgTable(
  "inventory_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceStoreId: uuid("source_store_id").notNull().references(() => stores.id, { onDelete: "restrict" }),
    destinationStoreId: uuid("destination_store_id").notNull().references(() => stores.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    referenceNumber: varchar("reference_number", { length: 120 }).notNull(),
    note: text("note"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceIdx: index("inventory_transfers_source_idx").on(table.sourceStoreId, table.status, table.createdAt),
    destinationIdx: index("inventory_transfers_destination_idx").on(table.destinationStoreId, table.status, table.createdAt),
    referenceUnique: uniqueIndex("inventory_transfers_reference_unique").on(table.referenceNumber)
  })
);

export const inventoryTransferLines = pgTable(
  "inventory_transfer_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id").notNull().references(() => inventoryTransfers.id, { onDelete: "cascade" }),
    sourceProductId: uuid("source_product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    sourceVariantId: uuid("source_variant_id").notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    destinationProductId: uuid("destination_product_id").references(() => products.id, { onDelete: "set null" }),
    destinationVariantId: uuid("destination_variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    receivedQuantity: integer("received_quantity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    transferIdx: index("inventory_transfer_lines_transfer_idx").on(table.transferId),
    sourceVariantIdx: index("inventory_transfer_lines_source_variant_idx").on(table.sourceVariantId)
  })
);

export const inventoryBatches = pgTable(
  "inventory_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    batchNumber: varchar("batch_number", { length: 140 }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    receivedQuantity: integer("received_quantity").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeExpiryIdx: index("inventory_batches_store_expiry_idx").on(table.storeId, table.expiryDate, table.status),
    variantIdx: index("inventory_batches_variant_idx").on(table.variantId),
    uniqueBatch: uniqueIndex("inventory_batches_store_variant_batch_unique").on(table.storeId, table.variantId, table.batchNumber)
  })
);

export const storeCapabilities = pgTable(
  "store_capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 100 }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    configuredBy: uuid("configured_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeCodeUnique: uniqueIndex("store_capabilities_store_code_unique").on(table.storeId, table.code),
    storeIdx: index("store_capabilities_store_idx").on(table.storeId, table.isEnabled)
  })
);

export const productImportRuns = pgTable(
  "product_import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    sourceFileName: varchar("source_file_name", { length: 255 }),
    mode: varchar("mode", { length: 40 }).notNull().default("create"),
    status: varchar("status", { length: 40 }).notNull().default("completed"),
    totalRows: integer("total_rows").notNull().default(0),
    successRows: integer("success_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    importedProductIds: jsonb("imported_product_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    results: jsonb("results").$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
    rolledBackBy: uuid("rolled_back_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("product_import_runs_store_idx").on(table.storeId, table.createdAt),
    statusIdx: index("product_import_runs_status_idx").on(table.status, table.rolledBackAt)
  })
);

export const financialProviders = pgTable(
  "financial_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    logoUrl: text("logo_url"),
    countryCode: varchar("country_code", { length: 10 }),
    currencyCode: varchar("currency_code", { length: 10 }).notNull().default("YER"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    isVisibleToMerchants: boolean("is_visible_to_merchants").notNull().default(true),
    supportsDeposits: boolean("supports_deposits").notNull().default(true),
    supportsWithdrawals: boolean("supports_withdrawals").notNull().default(false),
    supportsRefunds: boolean("supports_refunds").notNull().default(false),
    supportsCOD: boolean("supports_cod").notNull().default(false),
    featureFlags: jsonb("feature_flags").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("financial_providers_slug_unique").on(table.slug),
    typeStatusIdx: index("financial_providers_type_status_idx").on(table.type, table.status, table.isEnabled),
    visibleIdx: index("financial_providers_visible_idx").on(table.isVisibleToMerchants, table.sortOrder)
  })
);

export const merchantFinancialProviderAccounts = pgTable(
  "merchant_financial_provider_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    financialProviderId: uuid("financial_provider_id").notNull().references(() => financialProviders.id, { onDelete: "restrict" }),
    accountNumber: varchar("account_number", { length: 180 }),
    walletNumber: varchar("wallet_number", { length: 180 }),
    beneficiaryName: varchar("beneficiary_name", { length: 180 }),
    iban: varchar("iban", { length: 80 }),
    branchName: varchar("branch_name", { length: 180 }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeProviderIdx: index("merchant_financial_provider_accounts_store_provider_idx").on(table.storeId, table.financialProviderId, table.status),
    merchantIdx: index("merchant_financial_provider_accounts_merchant_idx").on(table.merchantId, table.status)
  })
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    financialProviderId: uuid("financial_provider_id").references(() => financialProviders.id, { onDelete: "restrict" }),
    merchantFinancialAccountId: uuid("merchant_financial_account_id").references(() => merchantFinancialProviderAccounts.id, { onDelete: "set null" }),
    name: varchar("name", { length: 140 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    description: text("description"),
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("payment_methods_code_unique").on(table.code),
    storeIdx: index("payment_methods_store_idx").on(table.storeId),
    activeIdx: index("payment_methods_active_idx").on(table.isActive)
  })
);

export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    description: text("description"),
    fee: numeric("fee", { precision: 12, scale: 2 }).notNull().default("0"),
    estimatedDaysMin: integer("estimated_days_min").notNull().default(1),
    estimatedDaysMax: integer("estimated_days_max").notNull().default(3),
    coverageConfig: jsonb("coverage_config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("shipping_methods_code_unique").on(table.code),
    storeIdx: index("shipping_methods_store_idx").on(table.storeId),
    activeIdx: index("shipping_methods_active_idx").on(table.isActive)
  })
);

export const orderStatusDefinitions = pgTable(
  "order_status_definitions",
  {
    code: varchar("code", { length: 80 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    color: varchar("color", { length: 30 }).notNull().default("slate"),
    sortOrder: integer("sort_order").notNull().default(0),
    allowedNextCodes: jsonb("allowed_next_codes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isTerminal: boolean("is_terminal").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    activeIdx: index("order_status_definitions_active_idx").on(table.isActive)
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    statusCode: varchar("status_code", { length: 80 })
      .notNull()
      .default("new")
      .references(() => orderStatusDefinitions.code, { onDelete: "restrict" }),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingFee: numeric("shipping_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),
    deliveryAddress: jsonb("delivery_address").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    customerNote: text("customer_note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    reservationStatus: varchar("reservation_status", { length: 40 }).notNull().default("none"),
    reservationExpiresAt: timestamp("reservation_expires_at", { withTimezone: true }),
    reservationReleasedAt: timestamp("reservation_released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    numberIdx: uniqueIndex("orders_number_unique").on(table.orderNumber),
    customerIdx: index("orders_customer_idx").on(table.customerId),
    storeIdx: index("orders_store_idx").on(table.storeId),
    statusIdx: index("orders_status_idx").on(table.statusCode),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    reservationIdx: index("orders_reservation_idx").on(table.reservationStatus, table.reservationExpiresAt)
  })
);


export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    transactionReference: varchar("transaction_reference", { length: 180 }),
    providerResponse: jsonb("provider_response").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("order_payments_order_idx").on(table.orderId),
    methodIdx: index("order_payments_method_idx").on(table.paymentMethodId),
    statusIdx: index("order_payments_status_idx").on(table.status)
  })
);

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderPaymentId: uuid("order_payment_id").references(() => orderPayments.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    transactionReference: varchar("transaction_reference", { length: 180 }),
    senderName: varchar("sender_name", { length: 180 }),
    senderPhone: varchar("sender_phone", { length: 60 }),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    proofUrl: text("proof_url"),
    note: text("note"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("payment_receipts_order_idx").on(table.orderId, table.status),
    paymentIdx: index("payment_receipts_payment_idx").on(table.orderPaymentId),
    storeIdx: index("payment_receipts_store_idx").on(table.storeId, table.status),
    userIdx: index("payment_receipts_user_idx").on(table.userId, table.createdAt),
    referenceIdx: index("payment_receipts_reference_idx").on(table.provider, table.transactionReference)
  })
);

export const merchantFinancialAccounts = pgTable(
  "merchant_financial_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    pendingBalance: numeric("pending_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimeEarnings: numeric("lifetime_earnings", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimePayouts: numeric("lifetime_payouts", { precision: 14, scale: 2 }).notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeUnique: uniqueIndex("merchant_financial_accounts_store_unique").on(table.storeId),
    merchantIdx: index("merchant_financial_accounts_merchant_idx").on(table.merchantId)
  })
);

export const merchantPayoutRequests = pgTable(
  "merchant_payout_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("requested"),
    method: varchar("method", { length: 80 }).notNull().default("bank_transfer"),
    destination: jsonb("destination").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("merchant_payout_requests_store_idx").on(table.storeId, table.status),
    merchantIdx: index("merchant_payout_requests_merchant_idx").on(table.merchantId, table.status),
    statusIdx: index("merchant_payout_requests_status_idx").on(table.status, table.createdAt)
  })
);

export const merchantLedgerEntries = pgTable(
  "merchant_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => merchantFinancialAccounts.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    orderPaymentId: uuid("order_payment_id").references(() => orderPayments.id, { onDelete: "set null" }),
    payoutRequestId: uuid("payout_request_id").references(() => merchantPayoutRequests.id, { onDelete: "set null" }),
    type: varchar("type", { length: 80 }).notNull(),
    direction: varchar("direction", { length: 20 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("posted"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("merchant_ledger_entries_account_idx").on(table.accountId, table.createdAt),
    storeIdx: index("merchant_ledger_entries_store_idx").on(table.storeId, table.createdAt),
    orderTypeUnique: uniqueIndex("merchant_ledger_entries_order_type_unique").on(table.orderId, table.type),
    payoutIdx: index("merchant_ledger_entries_payout_idx").on(table.payoutRequestId)
  })
);

export const financialCloseRuns = pgTable(
  "financial_close_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    totals: jsonb("totals").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    discrepancies: jsonb("discrepancies").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
    preparedBy: uuid("prepared_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    periodIdx: uniqueIndex("financial_close_runs_period_unique").on(table.periodStart, table.periodEnd),
    statusIdx: index("financial_close_runs_status_idx").on(table.status, table.periodEnd)
  })
);

export const scheduledReports = pgTable(
  "scheduled_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    reportType: varchar("report_type", { length: 80 }).notNull().default("financial_summary"),
    frequency: varchar("frequency", { length: 30 }).notNull().default("daily"),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Asia/Aden"),
    recipients: jsonb("recipients").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    outputFormat: varchar("output_format", { length: 20 }).notNull().default("csv"),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ dueIdx: index("scheduled_reports_due_idx").on(table.isActive, table.nextRunAt), typeIdx: index("scheduled_reports_type_idx").on(table.reportType) })
);

export const scheduledReportDeliveries = pgTable(
  "scheduled_report_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id").notNull().references(() => scheduledReports.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull().default("queued"),
    recipients: jsonb("recipients").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    outputFormat: varchar("output_format", { length: 20 }).notNull().default("csv"),
    error: text("error"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ reportIdx: index("scheduled_report_deliveries_report_idx").on(table.reportId, table.createdAt), statusIdx: index("scheduled_report_deliveries_status_idx").on(table.status, table.createdAt) })
);

export const operationalDrills = pgTable(
  "operational_drills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 80 }).notNull(),
    environment: varchar("environment", { length: 40 }).notNull().default("staging"),
    status: varchar("status", { length: 30 }).notNull().default("planned"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    executedBy: uuid("executed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ envKindIdx: index("operational_drills_env_kind_idx").on(table.environment, table.kind, table.status), createdIdx: index("operational_drills_created_idx").on(table.createdAt) })
);

/** Human and automated evidence submitted during parallel QA / Staging testing. */
export const qaTestRuns = pgTable(
  "qa_test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseKey: varchar("case_key", { length: 120 }).notNull(),
    environment: varchar("environment", { length: 40 }).notNull().default("staging"),
    category: varchar("category", { length: 80 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("planned"),
    severity: varchar("severity", { length: 30 }).notNull().default("info"),
    executorUserId: uuid("executor_user_id").references(() => users.id, { onDelete: "set null" }),
    evidenceUrl: text("evidence_url"),
    note: text("note"),
    failureSummary: text("failure_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    caseStatusIdx: index("qa_test_runs_case_status_idx").on(table.caseKey, table.status, table.createdAt),
    environmentStatusIdx: index("qa_test_runs_environment_status_idx").on(table.environment, table.status, table.createdAt),
    executorIdx: index("qa_test_runs_executor_idx").on(table.executorUserId, table.createdAt)
  })
);

export const releaseGateRuns = pgTable(
  "release_gate_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environment: varchar("environment", { length: 40 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    readinessScore: integer("readiness_score"),
    checks: jsonb("checks").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    source: varchar("source", { length: 80 }).notNull().default("admin"),
    note: text("note"),
    executedBy: uuid("executed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ envCreatedIdx: index("release_gate_runs_env_created_idx").on(table.environment, table.createdAt), statusIdx: index("release_gate_runs_status_idx").on(table.status, table.createdAt) })
);

/**
 * A recovery-only database must be intentionally initialized before any drill
 * is allowed to truncate it. The table is excluded from backups/restores, so
 * the authorization marker survives every recovery drill.
 */
export const backupRecoveryTargets = pgTable(
  "backup_recovery_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environment: varchar("environment", { length: 40 }).notNull(),
    targetLabel: varchar("target_label", { length: 120 }).notNull(),
    targetFingerprint: varchar("target_fingerprint", { length: 64 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    initializedAt: timestamp("initialized_at", { withTimezone: true }).notNull().defaultNow(),
    lastDrillAt: timestamp("last_drill_at", { withTimezone: true }),
    lastDrillStatus: varchar("last_drill_status", { length: 30 }),
    lastBackupFile: varchar("last_backup_file", { length: 255 }),
    lastBackupSha256: varchar("last_backup_sha256", { length: 64 }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    environmentUnique: uniqueIndex("backup_recovery_targets_environment_unique").on(table.environment),
    fingerprintUnique: uniqueIndex("backup_recovery_targets_fingerprint_unique").on(table.targetFingerprint),
    activeIdx: index("backup_recovery_targets_active_idx").on(table.environment, table.isActive)
  })
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderPaymentId: uuid("order_payment_id").references(() => orderPayments.id, { onDelete: "set null" }),
    returnRequestId: uuid("return_request_id").references(() => returnRequests.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    providerReference: varchar("provider_reference", { length: 180 }),
    providerResponse: jsonb("provider_response").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reason: text("reason"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("payment_refunds_order_idx").on(table.orderId, table.status),
    paymentIdx: index("payment_refunds_payment_idx").on(table.orderPaymentId),
    returnIdx: index("payment_refunds_return_idx").on(table.returnRequestId),
    providerIdx: index("payment_refunds_provider_idx").on(table.provider, table.providerReference)
  })
);

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 80 }).notNull(),
    eventId: varchar("event_id", { length: 180 }).notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    providerEventUnique: uniqueIndex("payment_provider_events_provider_event_unique").on(table.provider, table.eventId),
    typeIdx: index("payment_provider_events_type_idx").on(table.provider, table.eventType)
  })
);

export const orderShipments = pgTable(
  "order_shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, { onDelete: "set null" }),
    status: varchar("status", { length: 80 }).notNull().default("pending"),
    trackingNumber: varchar("tracking_number", { length: 180 }),
    carrierName: varchar("carrier_name", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("order_shipments_order_idx").on(table.orderId),
    methodIdx: index("order_shipments_method_idx").on(table.shippingMethodId),
    statusIdx: index("order_shipments_status_idx").on(table.status)
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    productName: varchar("product_name", { length: 180 }).notNull(),
    variantTitle: varchar("variant_title", { length: 180 }),
    sku: varchar("sku", { length: 120 }),
    productCode: varchar("product_code", { length: 120 }),
    imageUrl: text("image_url"),
    productSnapshot: jsonb("product_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
    productIdx: index("order_items_product_idx").on(table.productId)
  })
);


export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 80 }),
    toStatus: varchar("to_status", { length: 80 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("order_status_history_order_idx").on(table.orderId, table.createdAt),
    actorIdx: index("order_status_history_actor_idx").on(table.actorId)
  })
);

export const orderInvoices = pgTable(
  "order_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }).notNull().defaultNow(),
    status: varchar("status", { length: 40 }).notNull().default("issued"),
    externalInvoiceId: varchar("external_invoice_id", { length: 180 }),
    sourceSystem: varchar("source_system", { length: 120 }).notNull().default("salah_center"),
    erpPostedAt: timestamp("erp_posted_at", { withTimezone: true }),
    sellerSnapshot: jsonb("seller_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    buyerSnapshot: jsonb("buyer_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    totalsSnapshot: jsonb("totals_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    integrationMetadata: jsonb("integration_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: uniqueIndex("order_invoices_order_unique").on(table.orderId),
    numberIdx: uniqueIndex("order_invoices_number_unique").on(table.invoiceNumber),
    statusIdx: index("order_invoices_status_idx").on(table.status),
    externalIdx: index("order_invoices_external_idx").on(table.sourceSystem, table.externalInvoiceId)
  })
);

export const orderDisputes = pgTable(
  "order_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("open"),
    reason: varchar("reason", { length: 120 }).notNull(),
    description: text("description"),
    resolution: text("resolution"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("order_disputes_order_idx").on(table.orderId, table.status),
    customerIdx: index("order_disputes_customer_idx").on(table.customerId, table.status),
    storeIdx: index("order_disputes_store_idx").on(table.storeId, table.status)
  })
);

export const orderDisputeMessages = pgTable(
  "order_dispute_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => orderDisputes.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    message: text("message").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    disputeIdx: index("order_dispute_messages_dispute_idx").on(table.disputeId, table.createdAt)
  })
);

export const orderDisputeEvidence = pgTable(
  "order_dispute_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => orderDisputes.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    fileUrl: text("file_url").notNull(),
    title: varchar("title", { length: 180 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    disputeIdx: index("order_dispute_evidence_dispute_idx").on(table.disputeId, table.createdAt)
  })
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    isApproved: boolean("is_approved").notNull().default(true),
    moderationStatus: varchar("moderation_status", { length: 30 }).notNull().default("approved"),
    moderatedBy: uuid("moderated_by").references(() => users.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderationNote: text("moderation_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("reviews_store_idx").on(table.storeId),
    productIdx: index("reviews_product_idx").on(table.productId),
    userIdx: index("reviews_user_idx").on(table.userId)
  })
);

export const reviewMedia = pgTable(
  "review_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ reviewIdx: index("review_media_review_idx").on(table.reviewId, table.sortOrder) })
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    reason: varchar("reason", { length: 120 }).notNull(),
    detail: text("detail"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ reviewIdx: index("review_reports_review_idx").on(table.reviewId, table.status), reporterIdx: index("review_reports_reporter_idx").on(table.reporterId) })
);

export const reviewReplies = pgTable(
  "review_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ reviewUnique: uniqueIndex("review_replies_review_unique").on(table.reviewId), storeIdx: index("review_replies_store_idx").on(table.storeId) })
);

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    discountType: varchar("discount_type", { length: 40 }).notNull().default("percent"),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
    maxDiscount: numeric("max_discount", { precision: 12, scale: 2 }),
    minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("coupons_code_store_unique").on(table.code, table.storeId),
    storeIdx: index("coupons_store_idx").on(table.storeId, table.status),
    statusIdx: index("coupons_status_idx").on(table.status, table.startsAt, table.endsAt)
  })
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    couponIdx: index("coupon_redemptions_coupon_idx").on(table.couponId),
    userIdx: index("coupon_redemptions_user_idx").on(table.userId, table.code),
    orderIdx: index("coupon_redemptions_order_idx").on(table.orderId)
  })
);

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("requested"),
    reason: varchar("reason", { length: 120 }).notNull(),
    description: text("description"),
    resolution: text("resolution"),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: index("return_requests_order_idx").on(table.orderId, table.status),
    customerIdx: index("return_requests_customer_idx").on(table.customerId, table.status),
    storeIdx: index("return_requests_store_idx").on(table.storeId, table.status)
  })
);

export const returnRequestItems = pgTable(
  "return_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    returnRequestId: uuid("return_request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    reason: varchar("reason", { length: 160 }),
    condition: varchar("condition", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    returnIdx: index("return_request_items_return_idx").on(table.returnRequestId),
    orderItemIdx: index("return_request_items_order_item_idx").on(table.orderItemId)
  })
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: contentLevelEnum("level").notNull().default("marketplace"),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    summary: text("summary"),
    body: text("body"),
    imageUrl: text("image_url"),
    linkUrl: text("link_url"),
    isPinned: boolean("is_pinned").notNull().default(false),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: contentStatusEnum("status").notNull().default("draft"),
    isPromoted: boolean("is_promoted").notNull().default(false),
    promotionStart: timestamp("promotion_start", { withTimezone: true }),
    promotionEnd: timestamp("promotion_end", { withTimezone: true }),
    promotionPackage: varchar("promotion_package", { length: 80 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    levelIdx: index("announcements_level_idx").on(table.level),
    storeIdx: index("announcements_store_idx").on(table.storeId),
    scheduleIdx: index("announcements_schedule_idx").on(table.status, table.startAt, table.endAt),
    promotedIdx: index("announcements_promoted_idx").on(table.isPromoted, table.promotionStart, table.promotionEnd)
  })
);

export const news = pgTable(
  "news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: contentLevelEnum("level").notNull().default("marketplace"),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    isTicker: boolean("is_ticker").notNull().default(true),
    isPinned: boolean("is_pinned").notNull().default(false),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    levelIdx: index("news_level_idx").on(table.level),
    storeIdx: index("news_store_idx").on(table.storeId),
    tickerIdx: index("news_ticker_idx").on(table.isTicker, table.status)
  })
);

export const banners = pgTable(
  "banners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url").notNull(),
    linkUrl: text("link_url"),
    placement: varchar("placement", { length: 80 }).notNull().default("homepage_hero"),
    sortOrder: integer("sort_order").notNull().default(0),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placementIdx: index("banners_placement_idx").on(table.placement),
    scheduleIdx: index("banners_schedule_idx").on(table.status, table.startAt, table.endAt)
  })
);

export const homeSections = pgTable(
  "home_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    type: varchar("type", { length: 80 }).notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("home_sections_code_unique").on(table.code),
    sortIdx: index("home_sections_sort_idx").on(table.isVisible, table.sortOrder)
  })
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    durationDays: integer("duration_days").notNull().default(30),
    maxProducts: integer("max_products").notNull().default(100),
    maxEmployees: integer("max_employees").notNull().default(3),
    maxAnnouncements: integer("max_announcements").notNull().default(3),
    maxNews: integer("max_news").notNull().default(10),
    maxBranches: integer("max_branches").notNull().default(1),
    features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("subscriptions_code_unique").on(table.code)
  })
);

export const storeSubscriptions = pgTable(
  "store_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("store_subscriptions_store_idx").on(table.storeId),
    activeIdx: index("store_subscriptions_active_idx").on(table.isActive, table.endsAt)
  })
);

export const rentalAddons = pgTable(
  "rental_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 120 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    entitlementKey: varchar("entitlement_key", { length: 120 }).notNull(),
    price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
    billingCycle: varchar("billing_cycle", { length: 40 }).notNull().default("monthly"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("rental_addons_code_unique").on(table.code),
    activeIdx: index("rental_addons_active_idx").on(table.isActive, table.billingCycle)
  })
);

export const storeRentalAgreements = pgTable(
  "store_rental_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").references(() => merchantContracts.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    baseRent: numeric("base_rent", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    billingCycle: varchar("billing_cycle", { length: 40 }).notNull().default("monthly"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    graceDays: integer("grace_days").notNull().default(7),
    /** True when rent/add-ons are invoiced by the unified platform-revenue statement. */
    consolidatedBilling: boolean("consolidated_billing").notNull().default(false),
    nextInvoiceAt: timestamp("next_invoice_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: uniqueIndex("store_rental_agreements_store_unique").on(table.storeId),
    merchantIdx: index("store_rental_agreements_merchant_idx").on(table.merchantId, table.status),
    dueIdx: index("store_rental_agreements_due_idx").on(table.status, table.nextInvoiceAt)
  })
);

export const storeRentalAddonAssignments = pgTable(
  "store_rental_addon_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id").notNull().references(() => storeRentalAgreements.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id").notNull().references(() => rentalAddons.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    agreementIdx: index("store_rental_addon_assignments_agreement_idx").on(table.agreementId, table.status),
    uniqueActiveAddon: uniqueIndex("store_rental_addon_assignments_unique_active").on(table.agreementId, table.addonId)
  })
);

export const storeRentalInvoices = pgTable(
  "store_rental_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id").notNull().references(() => storeRentalAgreements.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    invoiceType: varchar("invoice_type", { length: 40 }).notNull().default("recurring_rent"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    baseAmount: numeric("base_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    addonsAmount: numeric("addons_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("issued"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 180 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    invoiceIdx: uniqueIndex("store_rental_invoices_number_unique").on(table.invoiceNumber),
    agreementIdx: index("store_rental_invoices_agreement_idx").on(table.agreementId, table.status),
    merchantIdx: index("store_rental_invoices_merchant_idx").on(table.merchantId, table.status),
    dueIdx: index("store_rental_invoices_due_idx").on(table.status, table.dueAt)
  })
);

export const featuredRuleSettings = pgTable(
  "featured_rule_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: varchar("target", { length: 40 }).notNull(), // store | product
    mode: varchar("mode", { length: 40 }).notNull().default("automatic"), // automatic | manual | mixed
    limit: integer("limit").notNull().default(12),
    durationDays: integer("duration_days").notNull().default(7),
    weights: jsonb("weights").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    targetIdx: uniqueIndex("featured_rule_settings_target_unique").on(table.target)
  })
);

export const masterSettingsVersions = pgTable(
  "master_settings_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reason: text("reason"),
    basedOnVersionId: uuid("based_on_version_id").references((): AnyPgColumn => masterSettingsVersions.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    versionUnique: uniqueIndex("master_settings_versions_version_unique").on(table.version),
    statusCreatedIdx: index("master_settings_versions_status_created_idx").on(table.status, table.createdAt)
  })
);

export const experiencePreviewSessions = pgTable(
  "experience_preview_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    scope: varchar("scope", { length: 80 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenUnique: uniqueIndex("experience_preview_sessions_token_hash_unique").on(table.tokenHash),
    ownerStatusIdx: index("experience_preview_sessions_owner_status_idx").on(table.createdBy, table.status, table.expiresAt)
  })
);

export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    group: varchar("group", { length: 80 }).notNull(),
    key: varchar("key", { length: 140 }).notNull(),
    value: jsonb("value").$type<unknown>().notNull().default(sql`'{}'::jsonb`),
    isPublic: boolean("is_public").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    keyIdx: uniqueIndex("system_settings_group_key_unique").on(table.group, table.key),
    publicIdx: index("system_settings_public_idx").on(table.isPublic)
  })
);

/** Versioned, locale-ready catalog for administrator-managed platform copy. */
export const platformTextEntries = pgTable(
  "platform_text_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    textKey: varchar("text_key", { length: 220 }).notNull(),
    namespace: varchar("namespace", { length: 80 }).notNull(),
    audience: varchar("audience", { length: 40 }).notNull().default("all"),
    description: text("description").notNull().default(""),
    isEditable: boolean("is_editable").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    keyUnique: uniqueIndex("platform_text_entries_key_unique").on(table.textKey),
    namespaceIdx: index("platform_text_entries_namespace_idx").on(table.namespace, table.audience)
  })
);

export const platformTextVersions = pgTable(
  "platform_text_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").notNull().references(() => platformTextEntries.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 20 }).notNull().default("ar"),
    value: text("value").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    versionNumber: integer("version_number").notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    versionUnique: uniqueIndex("platform_text_versions_entry_locale_version_unique").on(table.entryId, table.locale, table.versionNumber),
    entryLocaleStatusIdx: index("platform_text_versions_entry_locale_status_idx").on(table.entryId, table.locale, table.status, table.createdAt)
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body"),
    type: varchar("type", { length: 80 }).notNull().default("general"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId, table.readAt),
    storeIdx: index("notifications_store_idx").on(table.storeId)
  })
);


export const securityAlerts = pgTable(
  "security_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    severity: varchar("severity", { length: 30 }).notNull().default("medium"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    entityType: varchar("entity_type", { length: 120 }),
    entityId: varchar("entity_id", { length: 160 }),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    recommendedAction: text("recommended_action"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("security_alerts_status_idx").on(table.status, table.severity),
    typeIdx: index("security_alerts_type_idx").on(table.type),
    actorIdx: index("security_alerts_actor_idx").on(table.actorId),
    ipIdx: index("security_alerts_ip_idx").on(table.ipAddress),
    createdAtIdx: index("security_alerts_created_at_idx").on(table.createdAt)
  })
);

export const platformIncidents = pgTable(
  "platform_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentKey: varchar("incident_key", { length: 180 }).notNull(),
    severity: varchar("severity", { length: 30 }).notNull().default("warning"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    affectedService: varchar("affected_service", { length: 120 }).notNull().default("platform"),
    source: varchar("source", { length: 80 }).notNull().default("security_center"),
    rootCause: jsonb("root_cause").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    recommendation: text("recommendation"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    keyIdx: uniqueIndex("platform_incidents_key_unique").on(table.incidentKey),
    statusIdx: index("platform_incidents_status_idx").on(table.status, table.severity),
    serviceIdx: index("platform_incidents_service_idx").on(table.affectedService, table.lastSeenAt),
    detectedIdx: index("platform_incidents_detected_idx").on(table.detectedAt)
  })
);

export const platformIncidentEvents = pgTable(
  "platform_incident_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => platformIncidents.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 80 }).notNull().default("note"),
    message: text("message").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    incidentIdx: index("platform_incident_events_incident_idx").on(table.incidentId, table.createdAt),
    typeIdx: index("platform_incident_events_type_idx").on(table.type)
  })
);

export const platformHealthChecks = pgTable(
  "platform_health_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkKey: varchar("check_key", { length: 160 }).notNull(),
    service: varchar("service", { length: 120 }).notNull(),
    status: varchar("status", { length: 30 }).notNull(),
    latencyMs: integer("latency_ms"),
    message: text("message"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    checkCreatedIdx: index("platform_health_checks_key_created_idx").on(table.checkKey, table.createdAt),
    serviceIdx: index("platform_health_checks_service_idx").on(table.service, table.status)
  })
);

export const platformStructuredLogs = pgTable(
  "platform_structured_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: varchar("level", { length: 30 }).notNull().default("info"),
    category: varchar("category", { length: 80 }).notNull().default("system"),
    service: varchar("service", { length: 120 }).notNull().default("platform"),
    message: text("message").notNull(),
    correlationId: varchar("correlation_id", { length: 160 }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    requestPath: text("request_path"),
    ipAddress: varchar("ip_address", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    levelIdx: index("platform_structured_logs_level_idx").on(table.level, table.createdAt),
    serviceIdx: index("platform_structured_logs_service_idx").on(table.service, table.createdAt),
    correlationIdx: index("platform_structured_logs_correlation_idx").on(table.correlationId)
  })
);

/** Catalog only: a row advertises a reviewed connector package/capability, not an implicit ERP guarantee. */
export const erpConnectorCatalog = pgTable(
  "erp_connector_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 120 }).notNull(),
    provider: varchar("provider", { length: 160 }).notNull(),
    displayName: varchar("display_name", { length: 180 }).notNull(),
    version: varchar("version", { length: 80 }).notNull().default("1.0"),
    systemType: varchar("system_type", { length: 80 }).notNull().default("generic"),
    connectionModes: jsonb("connection_modes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    capabilities: jsonb("capabilities").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    supportOwner: varchar("support_owner", { length: 180 }),
    documentationUrl: text("documentation_url"),
    agentPackageUrl: text("agent_package_url"),
    packageChecksum: varchar("package_checksum", { length: 180 }),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeVersionUnique: uniqueIndex("erp_connector_catalog_code_version_unique").on(table.code, table.version),
    providerStatusIdx: index("erp_connector_catalog_provider_status_idx").on(table.provider, table.status),
    systemStatusIdx: index("erp_connector_catalog_system_status_idx").on(table.systemType, table.status)
  })
);

export const integrationClients = pgTable(
  "integration_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientKey: varchar("client_key", { length: 120 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull().default("accounting"),
    tokenHash: text("token_hash").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    storeIds: jsonb("store_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientKeyIdx: uniqueIndex("integration_clients_client_key_unique").on(table.clientKey),
    providerStatusIdx: index("integration_clients_provider_status_idx").on(table.provider, table.status),
    lastSeenIdx: index("integration_clients_last_seen_idx").on(table.lastSeenAt)
  })
);

export const erpConnectorCertifications = pgTable(
  "erp_connector_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationClientId: uuid("integration_client_id").notNull().references(() => integrationClients.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    certifiedAt: timestamp("certified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientIdx: uniqueIndex("erp_connector_certifications_client_unique").on(table.integrationClientId),
    storeIdx: index("erp_connector_certifications_store_idx").on(table.storeId, table.status),
    statusIdx: index("erp_connector_certifications_status_idx").on(table.status, table.updatedAt)
  })
);

/** Merchant request lifecycle for any ERP provider, before the store is allowed into ERP Mode. */
export const erpIntegrationRequests = pgTable(
  "erp_integration_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestNumber: varchar("request_number", { length: 80 }).notNull(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 160 }).notNull(),
    erpVersion: varchar("erp_version", { length: 100 }),
    erpType: varchar("erp_type", { length: 80 }).notNull().default("desktop"),
    connectionMethod: varchar("connection_method", { length: 80 }).notNull().default("local_agent"),
    branchCount: integer("branch_count").notNull().default(0),
    warehouseCount: integer("warehouse_count").notNull().default(0),
    businessActivity: varchar("business_activity", { length: 180 }),
    operationsVolume: varchar("operations_volume", { length: 80 }),
    technicalContact: jsonb("technical_contact").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    readiness: jsonb("readiness").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    mappingSummary: jsonb("mapping_summary").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 50 }).notNull().default("pending_review"),
    connectorCatalogId: uuid("connector_catalog_id").references(() => erpConnectorCatalog.id, { onDelete: "set null" }),
    integrationClientId: uuid("integration_client_id").references(() => integrationClients.id, { onDelete: "set null" }),
    certificationId: uuid("certification_id").references(() => erpConnectorCertifications.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "set null" }),
    merchantNote: text("merchant_note"),
    adminNote: text("admin_note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    numberUnique: uniqueIndex("erp_integration_requests_number_unique").on(table.requestNumber),
    storeStatusIdx: index("erp_integration_requests_store_status_idx").on(table.storeId, table.status, table.createdAt),
    merchantStatusIdx: index("erp_integration_requests_merchant_status_idx").on(table.merchantId, table.status, table.createdAt),
    connectorIdx: index("erp_integration_requests_connector_idx").on(table.connectorCatalogId, table.status),
    clientIdx: index("erp_integration_requests_client_idx").on(table.integrationClientId)
  })
);

export const erpIntegrationRequestEvents = pgTable(
  "erp_integration_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => erpIntegrationRequests.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    fromStatus: varchar("from_status", { length: 50 }),
    toStatus: varchar("to_status", { length: 50 }),
    note: text("note"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    requestIdx: index("erp_integration_request_events_request_idx").on(table.requestId, table.createdAt),
    actionIdx: index("erp_integration_request_events_action_idx").on(table.action, table.createdAt)
  })
);

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 80 }).notNull().default("accounting"),
    direction: varchar("direction", { length: 30 }).notNull().default("outbound"),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(10),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    dedupeKey: varchar("dedupe_key", { length: 220 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    providerStatusIdx: index("integration_events_provider_status_idx").on(table.provider, table.status, table.nextAttemptAt),
    entityIdx: index("integration_events_entity_idx").on(table.entityType, table.entityId),
    storeIdx: index("integration_events_store_idx").on(table.storeId, table.createdAt),
    eventTypeIdx: index("integration_events_event_type_idx").on(table.eventType, table.createdAt),
    dedupeIdx: uniqueIndex("integration_events_dedupe_unique").on(table.dedupeKey)
  })
);

export const integrationMappingProfiles = pgTable(
  "integration_mapping_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientKey: varchar("client_key", { length: 120 }).notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    systemType: varchar("system_type", { length: 80 }).notNull().default("generic"),
    resource: varchar("resource", { length: 80 }).notNull(),
    direction: varchar("direction", { length: 40 }).notNull().default("bidirectional"),
    version: integer("version").notNull().default(1),
    mapping: jsonb("mapping").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    sourceOfTruth: jsonb("source_of_truth").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    conflictPolicy: jsonb("conflict_policy").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientResourceIdx: index("integration_mapping_profiles_client_resource_idx").on(table.clientKey, table.resource, table.isActive),
    storeIdx: index("integration_mapping_profiles_store_idx").on(table.storeId, table.resource),
    uniqueClientResourceVersion: uniqueIndex("integration_mapping_profiles_client_resource_version_unique").on(table.clientKey, table.resource, table.version)
  })
);

export const integrationEntityLinks = pgTable(
  "integration_entity_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 80 }).notNull().default("accounting"),
    clientKey: varchar("client_key", { length: 120 }).notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    platformEntityId: varchar("platform_entity_id", { length: 160 }),
    externalEntityId: varchar("external_entity_id", { length: 180 }).notNull(),
    externalCode: varchar("external_code", { length: 180 }),
    externalFingerprint: varchar("external_fingerprint", { length: 180 }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    externalUnique: uniqueIndex("integration_entity_links_external_unique").on(table.clientKey, table.entityType, table.externalEntityId),
    platformIdx: index("integration_entity_links_platform_idx").on(table.entityType, table.platformEntityId),
    storeIdx: index("integration_entity_links_store_idx").on(table.storeId, table.entityType),
    codeIdx: index("integration_entity_links_code_idx").on(table.clientKey, table.entityType, table.externalCode)
  })
);

export const integrationSyncRuns = pgTable(
  "integration_sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientKey: varchar("client_key", { length: 120 }).notNull(),
    deviceId: varchar("device_id", { length: 160 }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    resource: varchar("resource", { length: 80 }).notNull(),
    direction: varchar("direction", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    counters: jsonb("counters").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    checkpoint: varchar("checkpoint", { length: 220 }),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientStartedIdx: index("integration_sync_runs_client_started_idx").on(table.clientKey, table.startedAt),
    storeResourceIdx: index("integration_sync_runs_store_resource_idx").on(table.storeId, table.resource, table.status),
    deviceIdx: index("integration_sync_runs_device_idx").on(table.deviceId, table.startedAt)
  })
);

export const erpConflictCases = pgTable(
  "erp_conflict_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    clientKey: varchar("client_key", { length: 120 }),
    mappingProfileId: uuid("mapping_profile_id").references(() => integrationMappingProfiles.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    platformEntityId: varchar("platform_entity_id", { length: 160 }),
    externalEntityId: varchar("external_entity_id", { length: 180 }),
    conflictType: varchar("conflict_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    platformSnapshot: jsonb("platform_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    externalSnapshot: jsonb("external_snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    resolution: jsonb("resolution").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("erp_conflict_cases_status_idx").on(table.status, table.createdAt),
    storeIdx: index("erp_conflict_cases_store_idx").on(table.storeId, table.status),
    entityIdx: index("erp_conflict_cases_entity_idx").on(table.entityType, table.platformEntityId),
    externalIdx: index("erp_conflict_cases_external_idx").on(table.clientKey, table.entityType, table.externalEntityId)
  })
);

export const integrationFailedSyncs = pgTable(
  "integration_failed_syncs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationEventId: uuid("integration_event_id").references(() => integrationEvents.id, { onDelete: "set null" }),
    syncRunId: uuid("sync_run_id").references(() => integrationSyncRuns.id, { onDelete: "set null" }),
    clientKey: varchar("client_key", { length: 120 }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    resource: varchar("resource", { length: 80 }).notNull(),
    direction: varchar("direction", { length: 40 }).notNull(),
    failureType: varchar("failure_type", { length: 80 }).notNull().default("processing_error"),
    status: varchar("status", { length: 40 }).notNull().default("open"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventIdx: index("integration_failed_syncs_event_idx").on(table.integrationEventId),
    statusIdx: index("integration_failed_syncs_status_idx").on(table.status, table.nextRetryAt),
    clientIdx: index("integration_failed_syncs_client_idx").on(table.clientKey, table.createdAt),
    storeIdx: index("integration_failed_syncs_store_idx").on(table.storeId, table.status)
  })
);

export const integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientKey: varchar("client_key", { length: 120 }),
    deviceId: varchar("device_id", { length: 160 }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 160 }),
    status: varchar("status", { length: 40 }).notNull().default("success"),
    requestId: varchar("request_id", { length: 160 }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientIdx: index("integration_audit_logs_client_idx").on(table.clientKey, table.createdAt),
    storeIdx: index("integration_audit_logs_store_idx").on(table.storeId, table.createdAt),
    actionIdx: index("integration_audit_logs_action_idx").on(table.action, table.status)
  })
);

export const integrationAgentDevices = pgTable(
  "integration_agent_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientKey: varchar("client_key", { length: 120 }).notNull(),
    deviceId: varchar("device_id", { length: 160 }).notNull(),
    deviceName: varchar("device_name", { length: 180 }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    agentVersion: varchar("agent_version", { length: 80 }),
    os: varchar("os", { length: 120 }),
    connectorType: varchar("connector_type", { length: 80 }),
    status: varchar("status", { length: 40 }).notNull().default("offline"),
    capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    lastHeartbeat: jsonb("last_heartbeat").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientDeviceIdx: uniqueIndex("integration_agent_devices_client_device_unique").on(table.clientKey, table.deviceId),
    clientIdx: index("integration_agent_devices_client_idx").on(table.clientKey, table.status),
    storeIdx: index("integration_agent_devices_store_idx").on(table.storeId, table.status),
    lastSeenIdx: index("integration_agent_devices_last_seen_idx").on(table.lastSeenAt)
  })
);

export const platformScalingEvents = pgTable(
  "platform_scaling_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: varchar("mode", { length: 40 }).notNull().default("recommendation"),
    direction: varchar("direction", { length: 40 }).notNull().default("hold"),
    severity: varchar("severity", { length: 30 }).notNull().default("info"),
    trigger: varchar("trigger", { length: 120 }).notNull().default("auto_scaling_intelligence"),
    status: varchar("status", { length: 40 }).notNull().default("recommended"),
    beforeState: jsonb("before_state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    desiredState: jsonb("desired_state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    signals: jsonb("signals").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    actions: jsonb("actions").$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
    providerResponse: jsonb("provider_response").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    correlationId: varchar("correlation_id", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    createdAtIdx: index("platform_scaling_events_created_at_idx").on(table.createdAt),
    modeIdx: index("platform_scaling_events_mode_idx").on(table.mode, table.status),
    directionIdx: index("platform_scaling_events_direction_idx").on(table.direction, table.severity),
    correlationIdx: index("platform_scaling_events_correlation_idx").on(table.correlationId)
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    category: varchar("category", { length: 40 }).notNull().default("administrative"),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    correlationId: varchar("correlation_id", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    actorIdx: index("audit_logs_actor_idx").on(table.actorId),
    categoryCreatedIdx: index("audit_logs_category_created_idx").on(table.category, table.createdAt),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    correlationIdx: index("audit_logs_correlation_idx").on(table.correlationId, table.createdAt),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt)
  })
);



export const offerCampaigns = pgTable(
  "offer_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    occasionType: varchar("occasion_type", { length: 80 }).notNull().default("seasonal"),
    description: text("description"),
    imageUrl: text("image_url"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    status: contentStatusEnum("status").notNull().default("active"),
    isHomepageVisible: boolean("is_homepage_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("offer_campaigns_slug_unique").on(table.slug),
    visibleIdx: index("offer_campaigns_visible_idx").on(table.status, table.isHomepageVisible, table.sortOrder)
  })
);

export const adminPromotionalOffers = pgTable(
  "admin_promotional_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    category: varchar("category", { length: 80 }).notNull().default("admin"),
    description: text("description"),
    imageUrl: text("image_url"),
    videoUrl: text("video_url"),
    contactName: varchar("contact_name", { length: 160 }),
    contactPhone: varchar("contact_phone", { length: 60 }),
    whatsappUrl: text("whatsapp_url"),
    locationText: text("location_text"),
    externalUrl: text("external_url"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    status: contentStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("admin_promotional_offers_slug_unique").on(table.slug),
    statusIdx: index("admin_promotional_offers_status_idx").on(table.status, table.startsAt, table.endsAt),
    featuredIdx: index("admin_promotional_offers_featured_idx").on(table.isFeatured, table.sortOrder)
  })
);

export const storeOfferCollections = pgTable(
  "store_offer_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => offerCampaigns.id, { onDelete: "set null" }),
    /** Native inventory product generated for this offer bundle. */
    offerProductId: uuid("offer_product_id").references(() => products.id, { onDelete: "set null" }),
    offerVariantId: uuid("offer_variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    /** Storefront publishes directly; homepage requires an admin decision. */
    publicationTarget: varchar("publication_target", { length: 40 }),
    publicationState: varchar("publication_state", { length: 40 }),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    storefrontPublishedAt: timestamp("storefront_published_at", { withTimezone: true }),
    homepageApprovedAt: timestamp("homepage_approved_at", { withTimezone: true }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    status: varchar("status", { length: 40 }).notNull().default("pending_review"),
    adminNote: text("admin_note"),
    bundleInitialQuantity: integer("bundle_initial_quantity").notNull().default(0),
    bundleRemainingQuantity: integer("bundle_remaining_quantity").notNull().default(0),
    bundleDissolvedQuantity: integer("bundle_dissolved_quantity").notNull().default(0),
    bundleInventoryMode: varchar("bundle_inventory_mode", { length: 40 }).notNull().default("direct"),
    bundleInventoryStatus: varchar("bundle_inventory_status", { length: 40 }).notNull().default("none"),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isPromoted: boolean("is_promoted").notNull().default(false),
    promotionStart: timestamp("promotion_start", { withTimezone: true }),
    promotionEnd: timestamp("promotion_end", { withTimezone: true }),
    promotionPackage: text("promotion_package"),
    sortOrder: integer("sort_order").notNull().default(0),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignIdx: index("store_offer_collections_campaign_idx").on(table.campaignId),
    storeIdx: index("store_offer_collections_store_idx").on(table.storeId),
    offerProductIdx: uniqueIndex("store_offer_collections_offer_product_unique").on(table.offerProductId),
    publicationIdx: index("store_offer_collections_publication_idx").on(table.publicationTarget, table.publicationState, table.startsAt, table.endsAt),
    statusIdx: index("store_offer_collections_status_idx").on(table.status),
    promotedIdx: index("store_offer_collections_promoted_idx").on(table.isPromoted, table.promotionStart, table.promotionEnd)
  })
);

export const storeOfferItems = pgTable(
  "store_offer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => storeOfferCollections.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }),
    imageUrl: text("image_url"),
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }),
    offerPrice: numeric("offer_price", { precision: 12, scale: 2 }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    offerIdx: index("store_offer_items_offer_idx").on(table.offerId),
    productIdx: index("store_offer_items_product_idx").on(table.productId)
  })
);


export const storeOfferBundleOperations = pgTable(
  "store_offer_bundle_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => storeOfferCollections.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    operationType: varchar("operation_type", { length: 40 }).notNull(),
    quantity: integer("quantity").notNull(),
    beforeRemaining: integer("before_remaining").notNull(),
    afterRemaining: integer("after_remaining").notNull(),
    itemsSnapshot: jsonb("items_snapshot").$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
    note: text("note"),
    idempotencyKey: varchar("idempotency_key", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    offerIdx: index("store_offer_bundle_operations_offer_idx").on(table.offerId, table.createdAt),
    storeIdx: index("store_offer_bundle_operations_store_idx").on(table.storeId, table.createdAt),
    idempotencyIdx: uniqueIndex("store_offer_bundle_operations_idempotency_unique").on(table.idempotencyKey)
  })
);

/**
 * Links a sold native offer product to its source offer. This lets cancellation
 * restore the bundle product stock without restoring its already-assembled
 * component products.
 */
export const storeOfferOrderAllocations = pgTable(
  "store_offer_order_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").notNull().references(() => storeOfferCollections.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    state: varchar("state", { length: 40 }).notNull().default("sold"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    restoredAt: timestamp("restored_at", { withTimezone: true })
  },
  (table) => ({
    orderOfferUnique: uniqueIndex("store_offer_order_allocations_order_offer_unique").on(table.orderId, table.offerId),
    orderIdx: index("store_offer_order_allocations_order_idx").on(table.orderId),
    offerStateIdx: index("store_offer_order_allocations_offer_state_idx").on(table.offerId, table.state)
  })
);

export const adminWorkAssignments = pgTable(
  "admin_work_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workKey: varchar("work_key", { length: 220 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }).notNull(),
    queue: varchar("queue", { length: 80 }).notNull().default("general"),
    status: varchar("status", { length: 40 }).notNull().default("open"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workKeyIdx: uniqueIndex("admin_work_assignments_work_key_unique").on(table.workKey),
    assigneeIdx: index("admin_work_assignments_assignee_idx").on(table.assignedTo, table.status, table.dueAt),
    queueIdx: index("admin_work_assignments_queue_idx").on(table.queue, table.status, table.priority)
  })
);

export const cmsPages = pgTable(
  "cms_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    type: varchar("type", { length: 80 }).notNull().default("page"),
    excerpt: text("excerpt"),
    content: text("content").notNull().default(""),
    status: contentStatusEnum("status").notNull().default("draft"),
    seo: jsonb("seo").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isSystem: boolean("is_system").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex("cms_pages_slug_unique").on(table.slug),
    typeIdx: index("cms_pages_type_idx").on(table.type),
    statusIdx: index("cms_pages_status_idx").on(table.status)
  })
);

export const cmsPageVersions = pgTable(
  "cms_page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cmsPageId: uuid("cms_page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    changeNote: text("change_note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pageVersionIdx: uniqueIndex("cms_page_versions_page_version_unique").on(table.cmsPageId, table.version),
    pageCreatedIdx: index("cms_page_versions_page_created_idx").on(table.cmsPageId, table.createdAt)
  })
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuKey: varchar("menu_key", { length: 80 }).notNull().default("main"),
    parentId: uuid("parent_id"),
    title: varchar("title", { length: 160 }).notNull(),
    url: text("url").notNull(),
    icon: varchar("icon", { length: 80 }),
    target: varchar("target", { length: 30 }).notNull().default("_self"),
    isVisible: boolean("is_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    menuIdx: index("menu_items_menu_idx").on(table.menuKey, table.isVisible, table.sortOrder),
    parentIdx: index("menu_items_parent_idx").on(table.parentId)
  })
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 140 }).notNull(),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    titleTemplate: varchar("title_template", { length: 220 }).notNull(),
    bodyTemplate: text("body_template").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeChannelIdx: uniqueIndex("notification_templates_code_channel_unique").on(table.code, table.channel),
    activeIdx: index("notification_templates_active_idx").on(table.isActive)
  })
);

export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    version: varchar("version", { length: 40 }).notNull().default("1.0"),
    body: text("body").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeVersionIdx: uniqueIndex("contract_templates_code_version_unique").on(table.code, table.version),
    activeIdx: index("contract_templates_active_idx").on(table.isActive, table.isDefault)
  })
);


export const merchantContracts = pgTable(
  "merchant_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractNumber: varchar("contract_number", { length: 60 }).notNull(),
    applicationId: uuid("application_id").references(() => merchantApplications.id, { onDelete: "set null" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull().default("عقد تشغيل متجر"),
    version: varchar("version", { length: 40 }).notNull().default("1.0"),
    bodySnapshot: text("body_snapshot"),
    signatureDataUrl: text("signature_data_url"),
    status: contractStatusEnum("status").notNull().default("active"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    alertBeforeDays: integer("alert_before_days").notNull().default(30),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    lastRenewedAt: timestamp("last_renewed_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    numberIdx: uniqueIndex("merchant_contracts_number_unique").on(table.contractNumber),
    storeIdx: index("merchant_contracts_store_idx").on(table.storeId),
    merchantIdx: index("merchant_contracts_merchant_idx").on(table.merchantId),
    statusIdx: index("merchant_contracts_status_idx").on(table.status),
    expiryIdx: index("merchant_contracts_expiry_idx").on(table.endAt, table.alertBeforeDays)
  })
);

/** Immutable amendment to an already signed merchant contract. */
export const merchantContractAddendums = pgTable(
  "merchant_contract_addendums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id").notNull().references(() => merchantContracts.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    amendmentNumber: varchar("amendment_number", { length: 100 }).notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    reason: text("reason"),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    bodySnapshot: text("body_snapshot").notNull(),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    accessTokenHash: text("access_token_hash"),
    signerName: varchar("signer_name", { length: 180 }),
    signatureUrl: text("signature_url"),
    signedSnapshot: jsonb("signed_snapshot").$type<Record<string, unknown>>(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    contractNumberUnique: uniqueIndex("merchant_contract_addendums_number_unique").on(table.contractId, table.amendmentNumber),
    storeStatusIdx: index("merchant_contract_addendums_store_status_idx").on(table.storeId, table.status, table.createdAt),
    merchantStatusIdx: index("merchant_contract_addendums_merchant_status_idx").on(table.merchantId, table.status)
  })
);

/** Merchant request to change contract-governed store identity fields. */
export const storeIdentityChangeRequests = pgTable(
  "store_identity_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    fieldKey: varchar("field_key", { length: 80 }).notNull(),
    currentValue: jsonb("current_value").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    requestedValue: jsonb("requested_value").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("pending_review"),
    addendumId: uuid("addendum_id").references(() => merchantContractAddendums.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeStatusIdx: index("store_identity_change_requests_store_status_idx").on(table.storeId, table.status, table.createdAt),
    merchantStatusIdx: index("store_identity_change_requests_merchant_status_idx").on(table.merchantId, table.status)
  })
);

export const merchantContractArchives = pgTable(
  "merchant_contract_archives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id").notNull().references(() => merchantContracts.id, { onDelete: "cascade" }),
    addendumId: uuid("addendum_id").references(() => merchantContractAddendums.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 80 }).notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    url: text("url"),
    storageKey: text("storage_key"),
    sha256: varchar("sha256", { length: 128 }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    error: text("error"),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    addendumKindVersionUnique: uniqueIndex("merchant_contract_archives_addendum_kind_version_unique").on(table.addendumId, table.kind, table.version),
    contractIdx: index("merchant_contract_archives_contract_idx").on(table.contractId, table.kind, table.createdAt),
    statusIdx: index("merchant_contract_archives_status_idx").on(table.status, table.updatedAt)
  })
);

export const contractEvents = pgTable(
  "contract_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => merchantContracts.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    reason: text("reason"),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    contractIdx: index("contract_events_contract_idx").on(table.contractId),
    storeIdx: index("contract_events_store_idx").on(table.storeId),
    actionIdx: index("contract_events_action_idx").on(table.action),
    createdAtIdx: index("contract_events_created_at_idx").on(table.createdAt)
  })
);

/**
 * Commercial terms for platform revenue only. Customer order payments and
 * merchant balances are intentionally outside this model.
 */
export const merchantRevenueTerms = pgTable(
  "merchant_revenue_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").references(() => merchantContracts.id, { onDelete: "set null" }),
    model: varchar("model", { length: 40 }).notNull().default("monthly_rent"),
    monthlyRent: numeric("monthly_rent", { precision: 14, scale: 2 }).notNull().default("0"),
    commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    dueDays: integer("due_days").notNull().default(7),
    graceDays: integer("grace_days").notNull().default(7),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeUnique: uniqueIndex("merchant_revenue_terms_store_unique").on(table.storeId),
    merchantStatusIdx: index("merchant_revenue_terms_merchant_status_idx").on(table.merchantId, table.status),
    activePeriodIdx: index("merchant_revenue_terms_active_period_idx").on(table.status, table.startsAt, table.endsAt)
  })
);

/** Promotion commercial agreement, deliberately independent from rent/commission terms. */
export const merchantPromotionAgreements = pgTable(
  "merchant_promotion_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").references(() => merchantContracts.id, { onDelete: "set null" }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    homepageBannerFee: numeric("homepage_banner_fee", { precision: 14, scale: 2 }).notNull().default("0"),
    featuredProductFee: numeric("featured_product_fee", { precision: 14, scale: 2 }).notNull().default("0"),
    featuredStoreFee: numeric("featured_store_fee", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeUnique: uniqueIndex("merchant_promotion_agreements_store_unique").on(table.storeId),
    merchantStatusIdx: index("merchant_promotion_agreements_merchant_status_idx").on(table.merchantId, table.status),
    activePeriodIdx: index("merchant_promotion_agreements_active_period_idx").on(table.status, table.startsAt, table.endsAt)
  })
);

/** Merchant-declared or future ERP/API sales total used exclusively for platform commission billing. */
export const merchantSalesReports = pgTable(
  "merchant_sales_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    salesTotal: numeric("sales_total", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    source: varchar("source", { length: 40 }).notNull().default("merchant_manual"),
    externalReference: varchar("external_reference", { length: 180 }),
    status: varchar("status", { length: 40 }).notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    periodUnique: uniqueIndex("merchant_sales_reports_store_period_unique").on(table.storeId, table.periodStart, table.periodEnd),
    merchantStatusIdx: index("merchant_sales_reports_merchant_status_idx").on(table.merchantId, table.status, table.periodEnd),
    reviewIdx: index("merchant_sales_reports_review_idx").on(table.status, table.submittedAt)
  })
);

/** One consolidated platform-only invoice/statement per store and billing period. */
export const merchantPlatformStatements = pgTable(
  "merchant_platform_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    revenueTermsId: uuid("revenue_terms_id").references(() => merchantRevenueTerms.id, { onDelete: "set null" }),
    statementNumber: varchar("statement_number", { length: 100 }).notNull(),
    sourceKey: varchar("source_key", { length: 180 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    rentAmount: numeric("rent_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    commissionBase: numeric("commission_base", { precision: 14, scale: 2 }).notNull().default("0"),
    commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    commissionAmount: numeric("commission_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    advertisingAmount: numeric("advertising_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    addonsAmount: numeric("addons_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    adjustmentAmount: numeric("adjustment_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    settledBy: uuid("settled_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceUnique: uniqueIndex("merchant_platform_statements_source_unique").on(table.sourceKey),
    numberUnique: uniqueIndex("merchant_platform_statements_number_unique").on(table.statementNumber),
    storeStatusIdx: index("merchant_platform_statements_store_status_idx").on(table.storeId, table.status, table.dueAt),
    merchantPeriodIdx: index("merchant_platform_statements_merchant_period_idx").on(table.merchantId, table.periodStart)
  })
);

export const merchantPlatformStatementLines = pgTable(
  "merchant_platform_statement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    statementId: uuid("statement_id").notNull().references(() => merchantPlatformStatements.id, { onDelete: "cascade" }),
    lineType: varchar("line_type", { length: 40 }).notNull(),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: varchar("source_id", { length: 180 }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmount: numeric("unit_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceUnique: uniqueIndex("merchant_platform_statement_lines_source_unique").on(table.statementId, table.sourceType, table.sourceId),
    statementIdx: index("merchant_platform_statement_lines_statement_idx").on(table.statementId, table.lineType)
  })
);

export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    scope: varchar("scope", { length: 40 }).notNull().default("platform"),
    wingId: uuid("wing_id").references(() => wings.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    rate: numeric("rate", { precision: 6, scale: 3 }).notNull().default("0"),
    fixedFee: numeric("fixed_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    minCommission: numeric("min_commission", { precision: 12, scale: 2 }),
    maxCommission: numeric("max_commission", { precision: 12, scale: 2 }),
    priority: integer("priority").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("commission_rules_code_unique").on(table.code),
    scopeIdx: index("commission_rules_scope_idx").on(table.scope, table.wingId, table.storeId),
    activeIdx: index("commission_rules_active_idx").on(table.isActive, table.priority)
  })
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    rate: numeric("rate", { precision: 6, scale: 3 }).notNull().default("0"),
    includedInPrice: boolean("included_in_price").notNull().default(false),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "cascade" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("tax_rules_code_unique").on(table.code),
    locationIdx: index("tax_rules_location_idx").on(table.countryId, table.governorateId),
    activeIdx: index("tax_rules_active_idx").on(table.isActive, table.priority)
  })
);

export const roleTemplates = pgTable(
  "role_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    scope: roleScopeEnum("scope").notNull().default("store"),
    description: text("description"),
    permissionCodes: jsonb("permission_codes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    inheritance: jsonb("inheritance").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeIdx: uniqueIndex("role_templates_code_unique").on(table.code),
    scopeIdx: index("role_templates_scope_idx").on(table.scope, table.isActive)
  })
);



export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull().default("محادثة مساعد التاجر"),
    type: varchar("type", { length: 80 }).notNull().default("merchant_assistant"),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("ai_conversations_store_idx").on(table.storeId, table.status),
    userIdx: index("ai_conversations_user_idx").on(table.userId, table.createdAt)
  })
);

export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
    type: varchar("type", { length: 80 }).notNull().default("growth"),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    severity: varchar("severity", { length: 30 }).notNull().default("info"),
    impactScore: integer("impact_score").notNull().default(0),
    actionUrl: text("action_url"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 40 }).notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("ai_recommendations_store_idx").on(table.storeId, table.status),
    typeIdx: index("ai_recommendations_type_idx").on(table.type, table.severity)
  })
);

/** Human-approved AI action proposals; proposals are not domain mutations by themselves. */
export const aiActionProposals = pgTable(
  "ai_action_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    audience: varchar("audience", { length: 30 }).notNull(),
    taskType: varchar("task_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    actionType: varchar("action_type", { length: 120 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    riskLevel: varchar("risk_level", { length: 30 }).notNull().default("low"),
    status: varchar("status", { length: 40 }).notNull().default("pending_approval"),
    provider: varchar("provider", { length: 80 }).notNull().default("rules"),
    model: varchar("model", { length: 120 }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    executionResult: jsonb("execution_result").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userStatusIdx: index("ai_action_proposals_user_status_idx").on(table.userId, table.status, table.createdAt),
    storeStatusIdx: index("ai_action_proposals_store_status_idx").on(table.storeId, table.status, table.createdAt),
    expiryIdx: index("ai_action_proposals_expiry_idx").on(table.status, table.expiresAt)
  })
);

export const aiLogs = pgTable(
  "ai_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    role: varchar("role", { length: 30 }).notNull().default("assistant"),
    prompt: text("prompt"),
    response: text("response"),
    model: varchar("model", { length: 120 }).notNull().default("local-enterprise-heuristic"),
    tokensUsed: integer("tokens_used").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationIdx: index("ai_logs_conversation_idx").on(table.conversationId, table.createdAt),
    storeIdx: index("ai_logs_store_idx").on(table.storeId, table.createdAt)
  })
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    frozenBalance: numeric("frozen_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    refundedBalance: numeric("refunded_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    rewardBalance: numeric("reward_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("wallets_user_unique").on(table.userId),
    statusIdx: index("wallets_status_idx").on(table.status)
  })
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("completed"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: varchar("reference_id", { length: 160 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    walletIdx: index("wallet_transactions_wallet_idx").on(table.walletId, table.createdAt),
    userIdx: index("wallet_transactions_user_idx").on(table.userId, table.createdAt),
    refIdx: index("wallet_transactions_ref_idx").on(table.referenceType, table.referenceId)
  })
);

export const rewardPoints = pgTable(
  "reward_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pointsBalance: integer("points_balance").notNull().default(0),
    lifetimeEarned: integer("lifetime_earned").notNull().default(0),
    lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
    tier: varchar("tier", { length: 40 }).notNull().default("standard"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("reward_points_user_unique").on(table.userId),
    tierIdx: index("reward_points_tier_idx").on(table.tier)
  })
);

export const rewardTransactions = pgTable(
  "reward_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    points: integer("points").notNull(),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: varchar("reference_id", { length: 160 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("reward_transactions_user_idx").on(table.userId, table.createdAt),
    refIdx: index("reward_transactions_ref_idx").on(table.referenceType, table.referenceId)
  })
);

export const cashbackTransactions = pgTable(
  "cashback_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    percentage: numeric("percentage", { precision: 6, scale: 3 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("cashback_transactions_user_idx").on(table.userId, table.status),
    orderIdx: index("cashback_transactions_order_idx").on(table.orderId)
  })
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    type: varchar("type", { length: 60 }).notNull().default("sponsored_products"),
    /** Canonical placement identifier; the display layer never infers placement from type alone. */
    placementId: varchar("placement_id", { length: 80 }).notNull().default("homepage_sponsored_products"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    /** cpc = bid per clean click; cpm = bid per thousand valid impressions. */
    billingModel: varchar("billing_model", { length: 20 }).notNull().default("cpc"),
    /** Operational state only; it is never proof of a collected payment. */
    billingState: varchar("billing_state", { length: 40 }).notNull().default("operational_reserve"),
    frequencyCap: integer("frequency_cap").notNull().default(3),
    /** Initial commercial policy is YER; explicit field prevents silent currency mixing. */
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    budget: numeric("budget", { precision: 14, scale: 2 }).notNull().default("0"),
    dailyBudget: numeric("daily_budget", { precision: 14, scale: 2 }).notNull().default("0"),
    spentAmount: numeric("spent_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    bidAmount: numeric("bid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    productIds: jsonb("product_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    targetConfig: jsonb("target_config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    creative: jsonb("creative").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    adminNote: text("admin_note"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: index("ad_campaigns_store_idx").on(table.storeId, table.status),
    statusIdx: index("ad_campaigns_status_idx").on(table.status, table.startsAt, table.endsAt)
  })
);

export const adCampaignDeliveryCounters = pgTable(
  "ad_campaign_delivery_counters",
  {
    campaignId: uuid("campaign_id").primaryKey().references(() => adCampaigns.id, { onDelete: "cascade" }),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    cleanClicks: integer("clean_clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    attributedRevenue: numeric("attributed_revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    platformRevenue: numeric("platform_revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    lastImpressionAt: timestamp("last_impression_at", { withTimezone: true }),
    lastClickAt: timestamp("last_click_at", { withTimezone: true }),
    lastConversionAt: timestamp("last_conversion_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  }
);

export const adClicks = pgTable(
  "ad_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    visitorHash: varchar("visitor_hash", { length: 128 }),
    placement: varchar("placement", { length: 80 }).notNull().default("unknown"),
    eventKey: varchar("event_key", { length: 180 }),
    cost: numeric("cost", { precision: 14, scale: 2 }).notNull().default("0"),
    /** pending | clean | suspected | invalid. Invalid clicks are retained for audit, never billed. */
    fraudStatus: varchar("fraud_status", { length: 20 }).notNull().default("pending"),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignIdx: index("ad_clicks_campaign_idx").on(table.campaignId, table.createdAt),
    storeIdx: index("ad_clicks_store_idx").on(table.storeId, table.createdAt),
    visitorIdx: index("ad_clicks_campaign_visitor_idx").on(table.campaignId, table.visitorHash, table.createdAt),
    eventKeyIdx: uniqueIndex("ad_clicks_event_key_unique").on(table.eventKey)
  })
);

export const adImpressions = pgTable(
  "ad_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    visitorHash: varchar("visitor_hash", { length: 128 }),
    placement: varchar("placement", { length: 80 }).notNull().default("search"),
    eventKey: varchar("event_key", { length: 180 }),
    cost: numeric("cost", { precision: 14, scale: 2 }).notNull().default("0"),
    /** pending | clean | suspected | invalid; only clean CPM impressions bill. */
    qualityStatus: varchar("quality_status", { length: 20 }).notNull().default("pending"),
    fraudScore: integer("fraud_score").notNull().default(0),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignIdx: index("ad_impressions_campaign_idx").on(table.campaignId, table.createdAt),
    storeIdx: index("ad_impressions_store_idx").on(table.storeId, table.createdAt),
    visitorIdx: index("ad_impressions_campaign_visitor_idx").on(table.campaignId, table.visitorHash, table.createdAt),
    qualityIdx: index("ad_impressions_campaign_quality_idx").on(table.campaignId, table.qualityStatus, table.createdAt),
    eventKeyIdx: uniqueIndex("ad_impressions_event_key_unique").on(table.eventKey)
  })
);

export const adBudgetReservations = pgTable(
  "ad_budget_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    reservationKey: varchar("reservation_key", { length: 180 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    reservedAmount: numeric("reserved_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    consumedAmount: numeric("consumed_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    releasedAmount: numeric("released_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignUnique: uniqueIndex("ad_budget_reservations_campaign_unique").on(table.campaignId),
    keyUnique: uniqueIndex("ad_budget_reservations_key_unique").on(table.reservationKey),
    storeStatusIdx: index("ad_budget_reservations_store_status_idx").on(table.storeId, table.status)
  })
);

export const adInvoices = pgTable(
  "ad_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    sourceKey: varchar("source_key", { length: 180 }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 40 }).notNull().default("issued"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    settledBy: uuid("settled_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceUnique: uniqueIndex("ad_invoices_source_unique").on(table.sourceKey),
    numberUnique: uniqueIndex("ad_invoices_number_unique").on(table.invoiceNumber),
    merchantStatusIdx: index("ad_invoices_merchant_status_idx").on(table.merchantId, table.status, table.dueAt),
    storePeriodIdx: index("ad_invoices_store_period_idx").on(table.storeId, table.periodStart)
  })
);

export const adBilling = pgTable(
  "ad_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => adInvoices.id, { onDelete: "set null" }),
    eventKey: varchar("event_key", { length: 180 }),
    billingType: varchar("billing_type", { length: 40 }).notNull().default("cpc"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignIdx: index("ad_billing_campaign_idx").on(table.campaignId, table.status),
    storeIdx: index("ad_billing_store_idx").on(table.storeId, table.status),
    campaignCreatedIdx: index("ad_billing_campaign_created_idx").on(table.campaignId, table.createdAt),
    invoiceIdx: index("ad_billing_invoice_idx").on(table.invoiceId),
    eventKeyIdx: uniqueIndex("ad_billing_event_key_unique").on(table.eventKey)
  })
);

export const homeExposureRequests = pgTable(
  "home_exposure_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 40 }).notNull().default("submitted"),
    placementId: varchar("placement_id", { length: 80 }).notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull().default("store"),
    targetId: varchar("target_id", { length: 160 }),
    commercialModel: varchar("commercial_model", { length: 40 }).notNull().default("duration"),
    requestedStartsAt: timestamp("requested_starts_at", { withTimezone: true }),
    requestedEndsAt: timestamp("requested_ends_at", { withTimezone: true }),
    visibilitySchedule: jsonb("visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    approvedPlacementId: varchar("approved_placement_id", { length: 80 }),
    approvedStartsAt: timestamp("approved_starts_at", { withTimezone: true }),
    approvedEndsAt: timestamp("approved_ends_at", { withTimezone: true }),
    approvedVisibilitySchedule: jsonb("approved_visibility_schedule").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    creative: jsonb("creative").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    quotedAmount: numeric("quoted_amount", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    activationPolicy: varchar("activation_policy", { length: 40 }).notNull().default("manual_admin"),
    financialCheckpointStatus: varchar("financial_checkpoint_status", { length: 40 }).notNull().default("awaiting_invoice"),
    financialReference: varchar("financial_reference", { length: 180 }),
    financialNote: text("financial_note"),
    financialCheckedBy: uuid("financial_checked_by").references(() => users.id, { onDelete: "set null" }),
    financialCheckedAt: timestamp("financial_checked_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    campaignId: uuid("campaign_id").references(() => adCampaigns.id, { onDelete: "set null" }),
    billingId: uuid("billing_id").references(() => adBilling.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignUnique: uniqueIndex("home_exposure_requests_campaign_unique").on(table.campaignId),
    storeStatusIdx: index("home_exposure_requests_store_status_idx").on(table.storeId, table.status, table.createdAt),
    merchantStatusIdx: index("home_exposure_requests_merchant_status_idx").on(table.merchantId, table.status, table.createdAt),
    statusCreatedIdx: index("home_exposure_requests_status_created_idx").on(table.status, table.createdAt),
    approvedWindowIdx: index("home_exposure_requests_approved_window_idx").on(table.approvedPlacementId, table.approvedStartsAt, table.approvedEndsAt),
    financialStatusIdx: index("home_exposure_requests_financial_status_idx").on(table.financialCheckpointStatus, table.status, table.createdAt)
  })
);

export const adInvoiceLines = pgTable(
  "ad_invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => adInvoices.id, { onDelete: "cascade" }),
    billingId: uuid("billing_id").notNull().references(() => adBilling.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    unitAmount: numeric("unit_amount", { precision: 14, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    billingUnique: uniqueIndex("ad_invoice_lines_billing_unique").on(table.billingId),
    invoiceIdx: index("ad_invoice_lines_invoice_idx").on(table.invoiceId, table.campaignId)
  })
);

export const adFraudSignals = pgTable(
  "ad_fraud_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    clickId: uuid("click_id").references(() => adClicks.id, { onDelete: "set null" }),
    eventKey: varchar("event_key", { length: 180 }).notNull(),
    signalType: varchar("signal_type", { length: 80 }).notNull(),
    score: integer("score").notNull().default(0),
    status: varchar("status", { length: 30 }).notNull().default("observed"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventSignalUnique: uniqueIndex("ad_fraud_signals_event_signal_unique").on(table.eventKey, table.signalType),
    campaignStatusIdx: index("ad_fraud_signals_campaign_status_idx").on(table.campaignId, table.status, table.createdAt),
    clickIdx: index("ad_fraud_signals_click_idx").on(table.clickId)
  })
);

/** Immutable credit notes for delivery later invalidated by fraud review. They
 * never mark a customer payment and remain separate from the original invoice. */
export const adCreditNotes = pgTable(
  "ad_credit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingId: uuid("billing_id").notNull().references(() => adBilling.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => adInvoices.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("issued"),
    reason: text("reason").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    billingUnique: uniqueIndex("ad_credit_notes_billing_unique").on(table.billingId),
    campaignStatusIdx: index("ad_credit_notes_campaign_status_idx").on(table.campaignId, table.status, table.createdAt),
    storeStatusIdx: index("ad_credit_notes_store_status_idx").on(table.storeId, table.status)
  })
);

export const adOrderAttributions = pgTable(
  "ad_order_attributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    clickId: uuid("click_id").references(() => adClicks.id, { onDelete: "set null" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    attributionToken: varchar("attribution_token", { length: 80 }).notNull(),
    placement: varchar("placement", { length: 80 }).notNull().default("unknown"),
    conversionValue: numeric("conversion_value", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("created"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    attributedAt: timestamp("attributed_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdx: uniqueIndex("ad_order_attributions_order_unique").on(table.orderId),
    campaignIdx: index("ad_order_attributions_campaign_idx").on(table.campaignId, table.status, table.createdAt),
    storeIdx: index("ad_order_attributions_store_idx").on(table.storeId, table.createdAt),
    tokenIdx: index("ad_order_attributions_token_idx").on(table.attributionToken)
  })
);

export const adReports = pgTable(
  "ad_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    reportDate: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    spend: numeric("spend", { precision: 14, scale: 2 }).notNull().default("0"),
    revenue: numeric("revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    ctr: numeric("ctr", { precision: 8, scale: 4 }).notNull().default("0"),
    cpc: numeric("cpc", { precision: 14, scale: 2 }).notNull().default("0"),
    cvr: numeric("cvr", { precision: 8, scale: 4 }).notNull().default("0"),
    invalidClicks: integer("invalid_clicks").notNull().default(0),
    roas: numeric("roas", { precision: 8, scale: 3 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ campaignDateIdx: index("ad_reports_campaign_date_idx").on(table.campaignId, table.reportDate), storeDateIdx: index("ad_reports_store_date_idx").on(table.storeId, table.reportDate) })
);

export const searchAnalytics = pgTable(
  "search_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query"),
    resultCount: integer("result_count").notNull().default(0),
    clickedType: varchar("clicked_type", { length: 60 }),
    clickedId: varchar("clicked_id", { length: 160 }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 160 }),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    source: varchar("source", { length: 80 }).notNull().default("site"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ queryIdx: index("search_analytics_query_idx").on(table.normalizedQuery), createdAtIdx: index("search_analytics_created_at_idx").on(table.createdAt) })
);

export const commerceFunnelEvents = pgTable(
  "commerce_funnel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    visitorHash: varchar("visitor_hash", { length: 128 }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventCreatedIdx: index("commerce_funnel_events_event_created_idx").on(table.eventType, table.createdAt),
    storeCreatedIdx: index("commerce_funnel_events_store_created_idx").on(table.storeId, table.createdAt),
    productCreatedIdx: index("commerce_funnel_events_product_created_idx").on(table.productId, table.createdAt),
    visitorCreatedIdx: index("commerce_funnel_events_visitor_created_idx").on(table.visitorHash, table.createdAt)
  })
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    plan: varchar("plan", { length: 60 }).notNull().default("starter"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    primaryStoreId: uuid("primary_store_id").references(() => stores.id, { onDelete: "set null" }),
    defaultLocale: varchar("default_locale", { length: 20 }).notNull().default("ar"),
    defaultCurrency: varchar("default_currency", { length: 10 }).notNull().default("YER"),
    isWhiteLabel: boolean("is_white_label").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ slugIdx: uniqueIndex("tenants_slug_unique").on(table.slug), statusIdx: index("tenants_status_idx").on(table.status, table.plan) })
);

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 80 }).notNull().default("owner"),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ uniqueUser: uniqueIndex("tenant_users_tenant_user_unique").on(table.tenantId, table.userId), tenantIdx: index("tenant_users_tenant_idx").on(table.tenantId, table.status) })
);

export const tenantStores = pgTable(
  "tenant_stores",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ pk: primaryKey({ columns: [table.tenantId, table.storeId] }) })
);

export const tenantDomains = pgTable(
  "tenant_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull(),
    type: varchar("type", { length: 40 }).notNull().default("subdomain"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    verificationToken: varchar("verification_token", { length: 180 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ domainIdx: uniqueIndex("tenant_domains_domain_unique").on(table.domain), tenantIdx: index("tenant_domains_tenant_idx").on(table.tenantId, table.status) })
);

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    group: varchar("group", { length: 80 }).notNull(),
    key: varchar("key", { length: 140 }).notNull(),
    value: jsonb("value").$type<unknown>().notNull().default(sql`'{}'::jsonb`),
    isPublic: boolean("is_public").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ keyIdx: uniqueIndex("tenant_settings_tenant_group_key_unique").on(table.tenantId, table.group, table.key) })
);

export const tenantThemes = pgTable(
  "tenant_themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull().default("Default Theme"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ tenantIdx: index("tenant_themes_tenant_idx").on(table.tenantId, table.isActive) })
);

export const tenantBilling = pgTable(
  "tenant_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    plan: varchar("plan", { length: 60 }).notNull().default("starter"),
    billingStatus: varchar("billing_status", { length: 60 }).notNull().default("trial"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    externalSubscriptionId: varchar("external_subscription_id", { length: 180 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({ tenantIdx: index("tenant_billing_tenant_idx").on(table.tenantId, table.billingStatus) })
);



export const storeGroups = pgTable(
  "store_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    merchantProfileId: uuid("merchant_profile_id").references(() => merchants.id, { onDelete: "set null" }),
    mainStoreId: uuid("main_store_id").references(() => stores.id, { onDelete: "set null" }),
    companyName: varchar("company_name", { length: 180 }).notNull(),
    commercialName: varchar("commercial_name", { length: 180 }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    merchantIdx: index("store_groups_merchant_idx").on(table.merchantId, table.status),
    mainStoreIdx: index("store_groups_main_store_idx").on(table.mainStoreId)
  })
);

export const storeBranchProfiles = pgTable(
  "store_branch_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => storeGroups.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    parentStoreId: uuid("parent_store_id").references(() => stores.id, { onDelete: "set null" }),
    branchCode: varchar("branch_code", { length: 80 }).notNull(),
    branchName: varchar("branch_name", { length: 180 }).notNull(),
    branchType: varchar("branch_type", { length: 40 }).notNull().default("branch"),
    countryId: uuid("country_id").references(() => countries.id, { onDelete: "set null" }),
    governorateId: uuid("governorate_id").references(() => governorates.id, { onDelete: "set null" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    districtId: uuid("district_id").references(() => districts.id, { onDelete: "set null" }),
    address: text("address"),
    rentAmount: numeric("rent_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    rentCurrency: varchar("rent_currency", { length: 10 }).notNull().default("YER"),
    rentCycle: varchar("rent_cycle", { length: 40 }).notNull().default("monthly"),
    rentStatus: varchar("rent_status", { length: 40 }).notNull().default("pending"),
    rentStartsAt: timestamp("rent_starts_at", { withTimezone: true }),
    nextRentDueAt: timestamp("next_rent_due_at", { withTimezone: true }),
    financialMode: varchar("financial_mode", { length: 40 }).notNull().default("legacy_branch_invoice"),
    revenueModel: varchar("revenue_model", { length: 40 }).notNull().default("monthly_rent"),
    commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    dueDays: integer("due_days").notNull().default(7),
    graceDays: integer("grace_days").notNull().default(7),
    parentContractId: uuid("parent_contract_id").references(() => merchantContracts.id, { onDelete: "set null" }),
    contractAddendumId: uuid("contract_addendum_id").references(() => merchantContractAddendums.id, { onDelete: "set null" }),
    revenueTermsId: uuid("revenue_terms_id").references(() => merchantRevenueTerms.id, { onDelete: "set null" }),
    approvalStatus: varchar("approval_status", { length: 40 }).notNull().default("pending_approval"),
    adminNote: text("admin_note"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    storeIdx: uniqueIndex("store_branch_profiles_store_unique").on(table.storeId),
    groupIdx: index("store_branch_profiles_group_idx").on(table.groupId, table.approvalStatus),
    codeIdx: uniqueIndex("store_branch_profiles_group_code_unique").on(table.groupId, table.branchCode),
    rentIdx: index("store_branch_profiles_rent_idx").on(table.rentStatus, table.nextRentDueAt),
    financialIdx: index("store_branch_profiles_financial_idx").on(table.financialMode, table.approvalStatus, table.parentContractId),
    addendumIdx: index("store_branch_profiles_addendum_idx").on(table.contractAddendumId)
  })
);

export const storeRentInvoices = pgTable(
  "store_rent_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => storeBranchProfiles.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("YER"),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 180 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    invoiceIdx: uniqueIndex("store_rent_invoices_number_unique").on(table.invoiceNumber),
    branchIdx: index("store_rent_invoices_branch_idx").on(table.branchId, table.status),
    merchantIdx: index("store_rent_invoices_merchant_idx").on(table.merchantId, table.status),
    dueIdx: index("store_rent_invoices_due_idx").on(table.status, table.dueAt)
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type MerchantApplication = typeof merchantApplications.$inferSelect;
export type NewMerchantApplication = typeof merchantApplications.$inferInsert;
