-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SessionClientType" AS ENUM ('web', 'admin', 'merchant', 'mobile');

-- CreateEnum
CREATE TYPE "SessionSignInMethod" AS ENUM ('PASSWORD', 'PASSWORD_NEW_DEVICE_CODE', 'PASSWORD_TOTP', 'PASSWORD_TOTP_NEW_DEVICE_CODE', 'PASSWORD_BACKUP_CODE', 'PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE', 'TEAM_INVITE_REGISTRATION', 'TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE', 'PASSWORD_PASSKEY', 'PASSWORD_PASSKEY_NEW_DEVICE_CODE', 'PASSKEY', 'PASSKEY_NEW_DEVICE_CODE');

-- CreateEnum
CREATE TYPE "TwoFactorLoginChallengePurpose" AS ENUM ('LOGIN', 'ROTATE');

-- CreateEnum
CREATE TYPE "MfaRecoveryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WebAuthnChallengePurpose" AS ENUM ('REGISTRATION', 'SECOND_FACTOR', 'PASSWORDLESS');

-- CreateEnum
CREATE TYPE "WebAuthnDeviceType" AS ENUM ('SINGLE_DEVICE', 'MULTI_DEVICE');

-- CreateEnum
CREATE TYPE "ImpersonationSessionEndReason" AS ENUM ('STOPPED');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST', 'PUBLISH', 'APPROVE', 'REJECT', 'SUSPEND', 'BAN', 'UNBAN', 'REACTIVATE', 'UNLOCK', 'REDEEM');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('USER', 'PROFILE', 'ROLE', 'PERMISSION', 'ADMIN_DASHBOARD', 'SYSTEM_SETTINGS', 'ANALYTICS', 'AUDIT_LOG', 'REPORT', 'EMAIL', 'GEO', 'REWARD', 'MERCHANT_ORG', 'REDEMPTION', 'SAMPLE_CATEGORY', 'PRODUCT', 'DEVTOOLS', 'ORDER', 'PAYMENT', 'INVENTORY', 'TENANT', 'LOCATION', 'GITHUB', 'GITHUB_PULL_REQUEST', 'KANBAN_TASK', 'KANBAN_BOARD', 'SERVER_METRIC', 'DATABASE_BACKUP', 'LOAD_TEST', 'MEMBER', 'KYB', 'ACCESS_REQUEST', 'SUPPORT_ACCESS', 'API_KEY', 'INVITE', 'SESSION', 'CUSTOMER_BAN', 'SHARE', 'CLAIM', 'TERMINAL', 'NOTIFICATION', 'BROADCAST', 'BROADCAST_REPORT', 'RATE_LIMIT', 'CACHE', 'BACKGROUND_JOB', 'STATUS_INCIDENT', 'FEATURE_FLAG', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'TENANT', 'LOCATION', 'RESOURCE', 'OWN');

-- CreateEnum
CREATE TYPE "AclEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('PLATFORM', 'TEMPLATE', 'TENANT');

-- CreateEnum
CREATE TYPE "ShareLevel" AS ENUM ('VIEW', 'EDIT');

-- CreateEnum
CREATE TYPE "AuthorizationDecision" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "CapabilityScope" AS ENUM ('PLATFORM', 'MERCHANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PermissionAuditActorKind" AS ENUM ('USER', 'SYSTEM_OPERATION');

-- CreateEnum
CREATE TYPE "SupportAccessGrantMode" AS ENUM ('READ_ONLY', 'WRITE_ELEVATED');

-- CreateEnum
CREATE TYPE "SupportAccessGrantStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_TENANT_APPROVAL', 'ACTIVE', 'EXPIRED', 'REVOKED', 'DENIED');

-- CreateEnum
CREATE TYPE "PilotCity" AS ENUM ('KUALA_LUMPUR', 'MELAKA');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "TenantLifecycleState" AS ENUM ('PROVISIONING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "LocationScopeType" AS ENUM ('ALL_LOCATIONS', 'SELECTED');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TenantInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TenantInvitationKind" AS ENUM ('PLATFORM_ONBOARDING', 'TEAM_MEMBER');

-- CreateEnum
CREATE TYPE "TenantAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantPlacementKind" AS ENUM ('SHARED', 'DEDICATED');

-- CreateEnum
CREATE TYPE "TenantEncryptionKeyStatus" AS ENUM ('ACTIVE', 'ROTATING', 'REVOKED');

-- CreateEnum
CREATE TYPE "TenantAppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantAssetType" AS ENUM ('LOGO', 'BANNER');

-- CreateEnum
CREATE TYPE "KybDocumentScanStatus" AS ENUM ('SCANNING', 'CLEAN', 'INFECTED', 'NOT_SCANNED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'SCANNING', 'READY', 'FAILED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PRODUCT_IMAGE', 'STORE_LOGO', 'STORE_BANNER', 'USER_AVATAR', 'MERCHANT_KYB', 'REWARD_IMAGE', 'GITHUB_COMMENT_IMAGE', 'KANBAN_TASK_ATTACHMENT', 'BROADCAST_IMAGE', 'PLATFORM_BROADCAST_IMAGE', 'NOTIFICATION_DOCUMENT');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('local', 's3', 'firebase');

-- CreateEnum
CREATE TYPE "FileVariantKind" AS ENUM ('ORIGINAL', 'THUMBNAIL', 'MEDIUM', 'LARGE', 'XLARGE', 'UHD');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DISCOUNT', 'FREE_ITEM', 'CASHBACK', 'POINTS', 'BOGO');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('CONSUMER', 'REFERRER');

-- CreateEnum
CREATE TYPE "RewardAudienceType" AS ENUM ('EVERYONE', 'SELECTED_CUSTOMERS');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardOtpPurpose" AS ENUM ('CLAIM');

-- CreateEnum
CREATE TYPE "RewardClaimHoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardReferralStatus" AS ENUM ('PENDING', 'CREDITED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RewardRedemptionMethod" AS ENUM ('SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "TenantApiKeyScope" AS ENUM ('POS', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "KanbanBoardKind" AS ENUM ('PLANNING', 'EXECUTION');

-- CreateEnum
CREATE TYPE "KanbanColumnKind" AS ENUM ('BACKLOG', 'REFINING', 'READY', 'PLANNED', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "KanbanItemType" AS ENUM ('EPIC', 'FEATURE', 'STORY', 'TASK', 'SUBTASK');

-- CreateEnum
CREATE TYPE "KanbanPlanningStage" AS ENUM ('BACKLOG', 'REFINING', 'READY', 'PLANNED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "KanbanWorkState" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "KanbanConversionStep" AS ENUM ('KEYS', 'COLUMNS', 'PLANNING_TRIAGE', 'CHECKLISTS');

-- CreateEnum
CREATE TYPE "KanbanChecklistKind" AS ENUM ('SUBTASKS', 'STEPS', 'ACCEPTANCE_CRITERIA');

-- CreateEnum
CREATE TYPE "KanbanLinkKind" AS ENUM ('BLOCKS', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "KanbanActivityKind" AS ENUM ('CREATED', 'UPDATED', 'MOVED', 'COMMENTED', 'ATTACHED', 'DETACHED', 'LINKED', 'UNLINKED', 'CHECKED', 'UNCHECKED');

-- CreateEnum
CREATE TYPE "KanbanActivityField" AS ENUM ('TITLE', 'DESCRIPTION', 'PRIORITY', 'TEAM', 'START', 'DUE', 'STORY_POINTS', 'PROGRESS', 'ASSIGNEE', 'PARENT', 'LABELS', 'SUBTASKS', 'STEPS', 'ACCEPTANCE_CRITERIA');

-- CreateEnum
CREATE TYPE "KanbanTaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "KanbanTeam" AS ENUM ('BACKEND', 'DATA', 'DESIGN', 'PLATFORM', 'PRODUCT', 'QA', 'SECURITY');

-- CreateEnum
CREATE TYPE "KanbanAttachmentKind" AS ENUM ('ATTACHMENT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'complained', 'failed');

-- CreateEnum
CREATE TYPE "EmailDeliveryOutcome" AS ENUM ('applied', 'stale', 'unmatched', 'ignored');

-- CreateEnum
CREATE TYPE "GithubAccountLinkStatus" AS ENUM ('ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReceivedWebhookProvider" AS ENUM ('GITHUB', 'RESEND', 'BILLPLZ', 'CHIP', 'FAKE_PAYMENTS', 'TWILIO');

-- CreateEnum
CREATE TYPE "ReceivedWebhookVerification" AS ENUM ('VALID', 'INVALID', 'MISSING', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "ReceivedWebhookOutcome" AS ENUM ('PROCESSING', 'RECORDED', 'DUPLICATE', 'IGNORED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "InboxDeadLetterReason" AS ENUM ('EMPTY_MESSAGE', 'MALFORMED_JSON', 'SCHEMA_VIOLATION', 'PERMANENT_PROCESSING_ERROR', 'RETRIES_EXHAUSTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAuthMethod" AS ENUM ('BEARER_TOKEN', 'SESSION_COOKIE', 'REFRESH_COOKIE', 'REFRESH_BODY', 'API_KEY');

-- CreateEnum
CREATE TYPE "IpAddressScope" AS ENUM ('PUBLIC', 'PRIVATE', 'LOOPBACK', 'LINK_LOCAL', 'SHARED', 'DOCUMENTATION', 'MULTICAST', 'RESERVED');

-- CreateEnum
CREATE TYPE "DataChangeOperation" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

-- CreateEnum
CREATE TYPE "DataChangeActorKind" AS ENUM ('USER', 'API_KEY', 'SYSTEM', 'UNATTRIBUTED');

-- CreateEnum
CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OpsServerProvider" AS ENUM ('LOCAL', 'DIGITALOCEAN', 'LINODE', 'VULTR', 'HETZNER', 'OTHER');

-- CreateEnum
CREATE TYPE "OpsResolution" AS ENUM ('MINUTE', 'HOUR');

-- CreateEnum
CREATE TYPE "OpsDependency" AS ENUM ('POSTGRES', 'REDIS', 'QUEUES', 'KAFKA', 'RABBITMQ', 'ENDPOINTS');

-- CreateEnum
CREATE TYPE "OpsAlertSubjectKind" AS ENUM ('SERVER', 'INSTANCE', 'DEPENDENCY', 'ENDPOINT');

-- CreateEnum
CREATE TYPE "OpsAlertRule" AS ENUM ('CPU_HIGH', 'MEMORY_HIGH', 'DISK_HIGH', 'SILENT', 'DEPENDENCY_DOWN', 'ENDPOINT_DOWN', 'TLS_EXPIRING');

-- CreateEnum
CREATE TYPE "OpsBackupStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OpsBackupTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "LoadTestTarget" AS ENUM ('SCENARIO', 'MIX', 'ENDPOINT');

-- CreateEnum
CREATE TYPE "LoadTestShape" AS ENUM ('CONSTANT', 'RAMP', 'SPIKE', 'SOAK');

-- CreateEnum
CREATE TYPE "LoadTestStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ABORTED', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SECURITY', 'ACCOUNT', 'TRANSACTIONAL', 'PRODUCT', 'MARKETING', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "NotificationSurface" AS ENUM ('CUSTOMER', 'MERCHANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'HELD', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "NotificationDigestFrequency" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "MarketingConsentScope" AS ENUM ('PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "MarketingConsentSource" AS ENUM ('SIGNUP', 'FIRST_CLAIM', 'SETTINGS', 'UNSUBSCRIBE_LINK', 'LEAVE_TENANT');

-- CreateEnum
CREATE TYPE "NotificationSuppressionCause" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'SMS_STOP', 'INVALID_NUMBER', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'PAUSED', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastSendMode" AS ENUM ('INSTANT', 'RECIPIENT_LOCAL_TIME');

-- CreateEnum
CREATE TYPE "BroadcastReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'SCAM');

-- CreateEnum
CREATE TYPE "BroadcastReportStatus" AS ENUM ('OPEN', 'DISMISSED', 'UPHELD');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('BILLPLZ', 'CHIP', 'FAKE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('CHECKOUT', 'CALLBACK', 'RECONCILE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentEventEffect" AS ENUM ('APPLIED', 'UNCHANGED', 'IGNORED');

-- CreateEnum
CREATE TYPE "RetentionTarget" AS ENUM ('AUDIT_LOG', 'DATA_CHANGE_LOG');

-- CreateEnum
CREATE TYPE "RetentionRunOutcome" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountErasureStatus" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OpsRestoreDrillOutcome" AS ENUM ('PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeatureFlagMode" AS ENUM ('DEFAULT', 'ON', 'OFF', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "StatusIncidentImpact" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StatusIncidentState" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookEndpointDisabledReason" AS ENUM ('MANUAL', 'FAILING');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'FAILED', 'SUCCEEDED', 'DEAD', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "fullName" VARCHAR(100) NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isLoadTestUser" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" BIGINT,
    "bannedByUserId" TEXT,
    "banReason" TEXT,
    "profileVersion" INTEGER NOT NULL DEFAULT 0,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "authorizationChangedAt" BIGINT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" BIGINT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretCiphertext" TEXT,
    "twoFactorSecretIv" VARCHAR(32),
    "twoFactorSecretKeyVersion" INTEGER,
    "twoFactorLastTotpStep" BIGINT,
    "mfaEnrolledAt" BIGINT,
    "mfaEnrollmentDeadline" BIGINT,
    "mfaAssuredAt" BIGINT,
    "emailVerifiedAt" BIGINT,
    "phone" VARCHAR(20),
    "phoneVerifiedAt" BIGINT,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "lastLoginAt" BIGINT,
    "erasedAt" BIGINT,
    "pendingAttributionToken" VARCHAR(64),
    "pendingAttributionExpiresAt" BIGINT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenDigest" VARCHAR(64),
    "expiresAt" BIGINT NOT NULL,
    "usedAt" BIGINT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupCode" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" BIGINT,

    CONSTRAINT "BackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorPendingSetup" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" VARCHAR(32) NOT NULL,
    "secretKeyVersion" INTEGER NOT NULL,
    "backupCodesHashes" JSONB NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "TwoFactorPendingSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorLoginChallenge" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "purpose" "TwoFactorLoginChallengePurpose" NOT NULL,
    "clientType" TEXT,
    "deviceInfo" VARCHAR(255),
    "ipAddress" VARCHAR(45),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" BIGINT,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "TwoFactorLoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "credentialId" VARCHAR(1364) NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceType" "WebAuthnDeviceType" NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "aaguid" VARCHAR(36) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "lastUsedAt" BIGINT,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT,
    "purpose" "WebAuthnChallengePurpose" NOT NULL,
    "challengeHash" VARCHAR(64) NOT NULL,
    "loginChallengeId" TEXT,
    "expiresAt" BIGINT NOT NULL,
    "consumedAt" BIGINT,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryRequest" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "status" "MfaRecoveryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" BIGINT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" BIGINT,
    "scheduledUnlockAt" BIGINT,
    "completedAt" BIGINT,
    "notes" TEXT,

    CONSTRAINT "MfaRecoveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "requestId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "fromStatus" "MfaRecoveryRequestStatus",
    "toStatus" "MfaRecoveryRequestStatus" NOT NULL,
    "impersonatorId" TEXT,
    "correlationId" VARCHAR(64),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),

    CONSTRAINT "MfaRecoveryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "token" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "rotationVersion" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "clientType" "SessionClientType",
    "browserName" VARCHAR(64),
    "browserVersion" VARCHAR(32),
    "osName" VARCHAR(64),
    "osVersion" VARCHAR(32),
    "deviceType" "DeviceType",
    "deviceModel" VARCHAR(64),
    "deviceName" VARCHAR(64),
    "appVersion" VARCHAR(64),
    "signInMethod" "SessionSignInMethod",
    "ipAddress" VARCHAR(45),
    "lastIpAddress" VARCHAR(45),
    "lastActiveAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "locationCountry" VARCHAR(2),
    "locationRegion" VARCHAR(64),
    "locationCity" VARCHAR(128),
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "impersonatorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "ImpersonationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "impersonatorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "endedAt" BIGINT,
    "endedBy" TEXT,
    "endReason" "ImpersonationSessionEndReason",
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "supportAccessGrantIds" VARCHAR(64)[] DEFAULT ARRAY[]::VARCHAR(64)[],

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAvatar" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kind" "RoleKind" NOT NULL DEFAULT 'PLATFORM',
    "tenantId" TEXT,
    "templateKey" "MembershipRole",
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "action" "PermissionAction" NOT NULL,
    "resource" "PermissionResource" NOT NULL,
    "description" TEXT,
    "scope" "PermissionScope" NOT NULL DEFAULT 'GLOBAL',
    "group" VARCHAR(100),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityDefinition" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "slug" VARCHAR(100) NOT NULL,
    "scope" "CapabilityScope" NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "groupName" VARCHAR(100),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissionId" TEXT,

    CONSTRAINT "CapabilityDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "actorKind" "PermissionAuditActorKind" NOT NULL DEFAULT 'USER',
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetRoleId" TEXT,
    "permissionId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "correlationId" VARCHAR(64),
    "impersonatorId" TEXT,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "assignedBy" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "AclEffect" NOT NULL DEFAULT 'ALLOW',
    "assignedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "assignedBy" TEXT,
    "expiresAt" BIGINT,
    "tenantId" TEXT,
    "locationId" TEXT,
    "grantedVia" VARCHAR(100),

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "assignedBy" TEXT,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceAcl" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "subjectType" VARCHAR(50) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resourceType" VARCHAR(50) NOT NULL,
    "resourceId" TEXT,
    "effect" "AclEffect" NOT NULL,
    "scope" "PermissionScope",
    "tenantId" TEXT,
    "locationId" TEXT,
    "expiresAt" BIGINT,
    "assignedBy" TEXT,
    "reason" TEXT,
    "membershipId" TEXT,
    "level" "ShareLevel",

    CONSTRAINT "ResourceAcl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationAudit" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "actorId" TEXT,
    "tenantId" TEXT,
    "locationId" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "resource" VARCHAR(120) NOT NULL,
    "resourceId" TEXT,
    "decision" "AuthorizationDecision" NOT NULL,
    "reason" TEXT,
    "policyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aclIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evaluation" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "requestId" VARCHAR(64),
    "durationMs" INTEGER,

    CONSTRAINT "AuthorizationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessGrant" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "mode" "SupportAccessGrantMode" NOT NULL DEFAULT 'READ_ONLY',
    "status" "SupportAccessGrantStatus" NOT NULL DEFAULT 'PENDING_TENANT_APPROVAL',
    "reason" TEXT NOT NULL,
    "ticketRef" VARCHAR(120),
    "tenantApprovedById" TEXT,
    "expiresAt" BIGINT NOT NULL,
    "revokedAt" BIGINT,

    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "slug" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "lifecycleState" "TenantLifecycleState" NOT NULL DEFAULT 'PROVISIONING',
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "isLoadTest" BOOLEAN NOT NULL DEFAULT false,
    "deletionGraceEndsAt" BIGINT,
    "broadcastsDisabledAt" BIGINT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSlugHistory" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "reservedUntil" BIGINT,

    CONSTRAINT "TenantSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "addressText" TEXT,
    "city" "PilotCity",
    "contactPhone" VARCHAR(20),
    "status" "LocationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rejectionReason" TEXT,
    "requestedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" BIGINT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "closureReason" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" VARCHAR(100),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipLocationScope" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "scopeType" "LocationScopeType" NOT NULL,
    "locationId" TEXT,
    "roleId" TEXT,

    CONSTRAINT "MembershipLocationScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMerchantProfile" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "legalName" VARCHAR(200),
    "category" VARCHAR(100),
    "addressText" TEXT,
    "city" "PilotCity" NOT NULL,
    "kybStatus" "KybStatus" NOT NULL DEFAULT 'PENDING',
    "kybFields" JSONB,
    "contactEmail" VARCHAR(100) NOT NULL,
    "contactPhone" VARCHAR(20),
    "requireRegisteredTerminals" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TenantMerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT,
    "email" CITEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "TenantInvitationKind" NOT NULL DEFAULT 'PLATFORM_ONBOARDING',
    "intendedRole" "MembershipRole" NOT NULL,
    "locationScopeType" "LocationScopeType" NOT NULL DEFAULT 'ALL_LOCATIONS',
    "status" "TenantInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdByAdminId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "expiresAt" BIGINT NOT NULL,
    "acceptedAt" BIGINT,
    "documentsSubmittedAt" BIGINT,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvitationLocationScope" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "TenantInvitationLocationScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAccessRequest" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TenantAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" BIGINT,

    CONSTRAINT "TenantAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSuspensionAppeal" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TenantAppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" BIGINT,
    "reviewNote" TEXT,

    CONSTRAINT "TenantSuspensionAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCustomerBan" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "sourceRedemptionId" TEXT,
    "reason" TEXT NOT NULL,
    "bannedByUserId" TEXT,
    "bannedAt" BIGINT NOT NULL,
    "liftedByUserId" TEXT,
    "liftedAt" BIGINT,

    CONSTRAINT "TenantCustomerBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLifecycleEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "fromState" "TenantLifecycleState",
    "toState" "TenantLifecycleState" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "correlationId" VARCHAR(64) NOT NULL,

    CONSTRAINT "TenantLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPlacement" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "kind" "TenantPlacementKind" NOT NULL DEFAULT 'SHARED',
    "regionCode" VARCHAR(32) NOT NULL DEFAULT 'default',

    CONSTRAINT "TenantPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantEncryptionKey" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "kmsKeyId" VARCHAR(255) NOT NULL,
    "status" "TenantEncryptionKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "rotatedAt" BIGINT,

    CONSTRAINT "TenantEncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "resourceType" VARCHAR(120) NOT NULL,
    "resourceId" VARCHAR(64),
    "decision" VARCHAR(32),
    "correlationId" VARCHAR(64),
    "metadata" JSONB,

    CONSTRAINT "TenantAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAsset" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "assetType" "TenantAssetType" NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "TenantAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantKybFile" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantKybFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "category" "FileCategory" NOT NULL,
    "visibility" "FileVisibility" NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expectedChecksum" VARCHAR(64) NOT NULL,
    "actualChecksum" VARCHAR(64),
    "storageProvider" "StorageProvider",
    "storageContainer" VARCHAR(255),
    "objectRevision" VARCHAR(64),
    "storageBucket" VARCHAR(255) NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "publicPath" VARCHAR(500),
    "objectGeneration" VARCHAR(64),
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "scanStatus" "KybDocumentScanStatus",
    "scannedAt" BIGINT,
    "scanResult" VARCHAR(500),
    "uploadedById" TEXT NOT NULL,
    "tenantId" TEXT,
    "productId" TEXT,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVariant" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "fileId" TEXT NOT NULL,
    "kind" "FileVariantKind" NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" "StorageProvider",
    "storageContainer" VARCHAR(255),
    "objectRevision" VARCHAR(64),
    "storageBucket" VARCHAR(255) NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "publicPath" VARCHAR(500),
    "objectGeneration" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "FileVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "rewardValue" INTEGER NOT NULL DEFAULT 0,
    "freeItemName" VARCHAR(200),
    "freeItemSku" VARCHAR(64),
    "termsConditions" TEXT,
    "rewardKind" "RewardKind" NOT NULL DEFAULT 'CONSUMER',
    "category" VARCHAR(100) NOT NULL,
    "rules" JSONB,
    "minSpendMinor" INTEGER,
    "quantityTotal" INTEGER NOT NULL,
    "quantityRemaining" INTEGER NOT NULL,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "startDate" BIGINT,
    "expiryDate" BIGINT NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'DRAFT',
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "referralsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "referralPoolTotal" INTEGER,
    "referralPoolRemaining" INTEGER,
    "referrerRewardId" TEXT,
    "parentConsumerRewardId" TEXT,
    "locationScopeType" "LocationScopeType" NOT NULL DEFAULT 'ALL_LOCATIONS',
    "audienceType" "RewardAudienceType" NOT NULL DEFAULT 'EVERYONE',
    "submittedForReviewAt" BIGINT,
    "autoPublishAt" BIGINT,
    "reviewedAt" BIGINT,
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardImage" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RewardImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLocationScope" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "RewardLocationScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAudienceMember" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RewardAudienceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLegalAcceptance" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "termsVersion" VARCHAR(32) NOT NULL,
    "privacyVersion" VARCHAR(32) NOT NULL,
    "acceptedAt" BIGINT NOT NULL,

    CONSTRAINT "RewardLegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "actorUserId" TEXT,
    "tenantId" TEXT,
    "action" VARCHAR(64) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "RewardAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "referralId" TEXT,
    "redemptionTokenHash" TEXT NOT NULL,
    "backupCodeHash" TEXT NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "isReferrerCredit" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" BIGINT NOT NULL,
    "claimExpiresAt" BIGINT NOT NULL,
    "redeemedAt" BIGINT,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaimHold" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "status" "RewardClaimHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" BIGINT NOT NULL,
    "settledAt" BIGINT,

    CONSTRAINT "RewardClaimHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardOtpChallenge" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "purpose" "RewardOtpPurpose" NOT NULL,
    "rewardId" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" BIGINT,

    CONSTRAINT "RewardOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardNotification" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" BIGINT,

    CONSTRAINT "RewardNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardReferral" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "referrerUserId" TEXT NOT NULL,
    "refereeUserId" TEXT,
    "rewardId" TEXT NOT NULL,
    "attributionToken" VARCHAR(64) NOT NULL,
    "status" "RewardReferralStatus" NOT NULL DEFAULT 'PENDING',
    "refereeDeviceHash" VARCHAR(128),
    "refereeIp" VARCHAR(45),
    "creditedAt" BIGINT,
    "creditNotifiedAt" BIGINT,
    "blockedReason" TEXT,

    CONSTRAINT "RewardReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupReferralCode" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "SignupReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupReferral" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "referrerUserId" TEXT NOT NULL,
    "refereeUserId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "successfulAt" BIGINT,
    "successNotifiedAt" BIGINT,

    CONSTRAINT "SignupReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantApiKey" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" VARCHAR(16) NOT NULL,
    "scope" "TenantApiKeyScope" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedAt" BIGINT,
    "lastUsedAt" BIGINT,
    "codeFailureCount" INTEGER NOT NULL DEFAULT 0,
    "codeFailureWindowStartedAt" BIGINT,
    "codeLockedUntil" BIGINT,

    CONSTRAINT "TenantApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantTerminal" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "terminalId" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "createdByUserId" TEXT NOT NULL,
    "pairingCodeIssuedByUserId" TEXT,
    "pairingCodeIssuedAt" BIGINT,
    "apiKeyId" TEXT,
    "pairingCodeHash" VARCHAR(80),
    "pairingCodeExpiresAt" BIGINT,
    "pairedAt" BIGINT,
    "lastSeenAt" BIGINT,

    CONSTRAINT "TenantTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "claimId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "userId" TEXT NOT NULL,
    "terminalId" VARCHAR(100) NOT NULL,
    "redemptionMethod" "RewardRedemptionMethod" NOT NULL,
    "saleId" TEXT NOT NULL,
    "redeemedAt" BIGINT NOT NULL,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSale" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "userId" TEXT NOT NULL,
    "terminalId" VARCHAR(100) NOT NULL,
    "apiKeyId" TEXT,
    "billTotalMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "paidAt" BIGINT NOT NULL,

    CONSTRAINT "RewardSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "productId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleCategory" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "description" TEXT,
    "isActive" BOOLEAN,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SampleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "brand" VARCHAR(120),
    "categoryId" TEXT NOT NULL,
    "compareAtPrice" DECIMAL(18,2),
    "description" TEXT,
    "imageUrl" VARCHAR(2048),
    "isActive" BOOLEAN,
    "isFeatured" BOOLEAN,
    "name" VARCHAR(200) NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "shortDescription" VARCHAR(500),
    "sku" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "stockQuantity" INTEGER,
    "weightGrams" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanColumn" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "board" "KanbanBoardKind" NOT NULL DEFAULT 'EXECUTION',
    "title" VARCHAR(60) NOT NULL,
    "kind" "KanbanColumnKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "wipLimit" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanPlanningColumn" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "title" VARCHAR(60) NOT NULL,
    "stage" "KanbanPlanningStage" NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanbanPlanningColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanExecutionColumn" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "title" VARCHAR(60) NOT NULL,
    "state" "KanbanWorkState" NOT NULL,
    "position" INTEGER NOT NULL,
    "wipLimit" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanbanExecutionColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanLevelCounter" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "level" "KanbanItemType" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanbanLevelCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanConversionStage" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "stage" "KanbanConversionStep" NOT NULL,
    "completedAt" BIGINT NOT NULL,
    "report" JSONB NOT NULL,

    CONSTRAINT "KanbanConversionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTask" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "columnId" TEXT,
    "planningColumnId" TEXT,
    "executionColumnId" TEXT,
    "key" VARCHAR(24),
    "type" "KanbanItemType" NOT NULL DEFAULT 'STORY',
    "parentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "priority" "KanbanTaskPriority" NOT NULL,
    "team" "KanbanTeam" NOT NULL,
    "startAt" BIGINT,
    "dueAt" BIGINT,
    "storyPoints" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "labels" VARCHAR(24)[] DEFAULT ARRAY[]::VARCHAR(24)[],
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanbanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTaskComment" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,

    CONSTRAINT "KanbanTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTaskAttachment" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "taskId" TEXT NOT NULL,
    "commentId" TEXT,
    "fileId" TEXT NOT NULL,
    "kind" "KanbanAttachmentKind" NOT NULL,

    CONSTRAINT "KanbanTaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanChecklistItem" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "taskId" TEXT NOT NULL,
    "list" "KanbanChecklistKind" NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(200) NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "KanbanChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTaskWatcher" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "KanbanTaskWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTaskLink" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "sourceTaskId" TEXT NOT NULL,
    "targetTaskId" TEXT NOT NULL,
    "kind" "KanbanLinkKind" NOT NULL,

    CONSTRAINT "KanbanTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTaskActivity" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "taskId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "KanbanActivityKind" NOT NULL,
    "field" "KanbanActivityField",
    "fromValue" VARCHAR(200),
    "toValue" VARCHAR(200),

    CONSTRAINT "KanbanTaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "templateKey" TEXT NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL,
    "resendId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "lastEventAt" BIGINT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "webhookId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "resendId" VARCHAR(255) NOT NULL,
    "emailLogId" TEXT,
    "status" "EmailLogStatus",
    "detail" VARCHAR(300),
    "occurredAt" BIGINT NOT NULL,
    "outcome" "EmailDeliveryOutcome" NOT NULL,

    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subregion" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "Subregion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "iso3" VARCHAR(3),
    "numericCode" VARCHAR(3),
    "iso2" VARCHAR(2),
    "phonecode" VARCHAR(255),
    "capital" VARCHAR(255),
    "currency" VARCHAR(255),
    "currencyName" VARCHAR(255),
    "currencySymbol" VARCHAR(255),
    "tld" VARCHAR(255),
    "native" VARCHAR(255),
    "population" BIGINT,
    "gdp" BIGINT,
    "region" VARCHAR(255),
    "subregion" VARCHAR(255),
    "nationality" VARCHAR(255),
    "timezones" JSONB,
    "translations" JSONB,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "emoji" VARCHAR(191),
    "emojiU" VARCHAR(191),
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "regionId" INTEGER,
    "subregionId" INTEGER,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "fipsCode" VARCHAR(255),
    "iso2" VARCHAR(255),
    "iso3166_2" VARCHAR(255),
    "type" VARCHAR(191),
    "level" INTEGER,
    "parentId" INTEGER,
    "native" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "timezone" VARCHAR(255),
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "countryId" INTEGER NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "stateCode" VARCHAR(255) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "native" VARCHAR(255),
    "timezone" VARCHAR(255),
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "stateId" INTEGER NOT NULL,
    "countryId" INTEGER NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubAccountLink" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "githubUserId" BIGINT NOT NULL,
    "githubLogin" VARCHAR(39) NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenKeyVersion" INTEGER NOT NULL,
    "tokenExpiresAt" BIGINT,
    "status" "GithubAccountLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" BIGINT NOT NULL,

    CONSTRAINT "GithubAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubWebhookSubscription" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "owner" VARCHAR(39) NOT NULL,
    "repository" VARCHAR(100) NOT NULL,
    "githubHookId" BIGINT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "GithubWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubWebhookDelivery" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "deliveryId" VARCHAR(64) NOT NULL,
    "event" VARCHAR(64) NOT NULL,
    "owner" VARCHAR(39) NOT NULL,
    "repository" VARCHAR(100) NOT NULL,
    "pullRequestNumber" INTEGER,
    "receivedAt" BIGINT NOT NULL,

    CONSTRAINT "GithubWebhookDelivery_pkey" PRIMARY KEY ("deliveryId")
);

-- CreateTable
CREATE TABLE "ReceivedWebhook" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "provider" "ReceivedWebhookProvider" NOT NULL,
    "providerDeliveryId" VARCHAR(255),
    "eventType" VARCHAR(100),
    "verification" "ReceivedWebhookVerification" NOT NULL,
    "outcome" "ReceivedWebhookOutcome" NOT NULL,
    "httpStatus" INTEGER,
    "payloadSha256" VARCHAR(64) NOT NULL,
    "payloadBytes" INTEGER NOT NULL,
    "headers" JSONB NOT NULL,
    "correlationId" VARCHAR(128),
    "errorSummary" VARCHAR(500),
    "receivedAt" BIGINT NOT NULL,
    "lastReceivedAt" BIGINT NOT NULL,
    "claimedAt" BIGINT,
    "completedAt" BIGINT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceivedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "topic" VARCHAR(100) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "partitionKey" VARCHAR(255),
    "correlationId" VARCHAR(64),
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "publishedAt" BIGINT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxProcessedEvent" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "consumer" VARCHAR(100) NOT NULL,
    "eventId" UUID NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "processedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,

    CONSTRAINT "InboxProcessedEvent_pkey" PRIMARY KEY ("consumer","eventId")
);

-- CreateTable
CREATE TABLE "InboxDeadLetter" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "consumer" VARCHAR(100) NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "partition" INTEGER NOT NULL,
    "offset" VARCHAR(32) NOT NULL,
    "eventId" UUID,
    "reason" "InboxDeadLetterReason" NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "rawValue" BYTEA,
    "rawValueSizeBytes" INTEGER,
    "rawValueSha256" CHAR(64),
    "rawValueTruncated" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,

    CONSTRAINT "InboxDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "topic" VARCHAR(100) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "correlationId" VARCHAR(64),
    "partitionKey" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "occurredAt" BIGINT NOT NULL,
    "ingestedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "correlationId" VARCHAR(64) NOT NULL,
    "traceId" VARCHAR(64),
    "occurredAt" BIGINT NOT NULL,
    "completedAt" BIGINT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(512) NOT NULL,
    "path" VARCHAR(2048) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "errorCode" VARCHAR(64),
    "actorUserId" VARCHAR(64),
    "impersonatorUserId" VARCHAR(64),
    "impersonationSessionId" VARCHAR(64),
    "supportAccessGrantId" VARCHAR(64),
    "sessionId" VARCHAR(64),
    "authMethod" "AuditAuthMethod",
    "apiKeyId" VARCHAR(64),
    "terminalId" VARCHAR(64),
    "tenantId" VARCHAR(64),
    "locationId" VARCHAR(64),
    "claimedTenantId" VARCHAR(64),
    "claimedLocationId" VARCHAR(64),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "browserName" VARCHAR(64),
    "browserVersion" VARCHAR(32),
    "osName" VARCHAR(64),
    "osVersion" VARCHAR(32),
    "deviceType" "DeviceType",
    "deviceModel" VARCHAR(64),
    "ipVersion" SMALLINT,
    "ipScope" "IpAddressScope",
    "geoCountry" VARCHAR(2),
    "geoRegion" VARCHAR(64),
    "geoCity" VARCHAR(128),
    "geoTimeZone" VARCHAR(64),
    "clientType" VARCHAR(32),
    "httpVersion" VARCHAR(8),
    "host" VARCHAR(255),
    "origin" VARCHAR(512),
    "referer" VARCHAR(2048),
    "acceptLanguage" VARCHAR(256),
    "requestContentType" VARCHAR(256),
    "requestBytes" INTEGER,
    "idempotencyKey" VARCHAR(255),
    "requestHeaders" JSONB,
    "requestParams" JSONB,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "errorDetail" JSONB,
    "systemOperations" TEXT[],

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataChangeLog" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "changeSequence" BIGSERIAL NOT NULL,
    "occurredAt" BIGINT NOT NULL,
    "transactionId" BIGINT NOT NULL,
    "tableName" VARCHAR(63) NOT NULL,
    "operation" "DataChangeOperation" NOT NULL,
    "rowId" VARCHAR(512),
    "changedColumns" TEXT[],
    "oldData" JSONB,
    "newData" JSONB,
    "actorKind" "DataChangeActorKind" NOT NULL,
    "actorUserId" VARCHAR(64),
    "tenantId" VARCHAR(64),
    "apiKeyId" VARCHAR(64),
    "systemOperation" VARCHAR(100),
    "actorPurpose" VARCHAR(512),
    "correlationId" VARCHAR(64),
    "databaseRole" VARCHAR(63) NOT NULL,
    "loginRole" VARCHAR(63) NOT NULL,
    "applicationName" VARCHAR(64),
    "clientAddress" VARCHAR(64),

    CONSTRAINT "DataChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataChangeGroup" (
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "groupKey" VARCHAR(64) NOT NULL,
    "firstChangeId" UUID NOT NULL,
    "firstChangeSequence" BIGINT NOT NULL,
    "transactionId" BIGINT NOT NULL,
    "correlationId" VARCHAR(64),
    "occurredAt" BIGINT NOT NULL,

    CONSTRAINT "DataChangeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformResourceIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "scope" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(128) NOT NULL,
    "status" "IdempotencyRecordStatus" NOT NULL,
    "leaseToken" UUID NOT NULL,
    "responseBody" JSONB,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "PlatformResourceIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsServer" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "name" VARCHAR(100) NOT NULL,
    "provider" "OpsServerProvider" NOT NULL,
    "providerServerId" VARCHAR(64),
    "agentTokenHash" VARCHAR(64) NOT NULL,
    "agentTokenPrefix" VARCHAR(16) NOT NULL,
    "lastSeenAt" BIGINT,
    "agentVersion" VARCHAR(40),
    "hostname" VARCHAR(200),
    "os" VARCHAR(200),
    "kernel" VARCHAR(200),
    "cpuModel" VARCHAR(200),
    "cpuCores" INTEGER,
    "memoryTotalBytes" BIGINT,
    "uptimeSeconds" BIGINT,

    CONSTRAINT "OpsServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsServerSample" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "serverId" TEXT NOT NULL,
    "resolution" "OpsResolution" NOT NULL,
    "bucketStart" BIGINT NOT NULL,
    "cpuPercentAvg" DOUBLE PRECISION NOT NULL,
    "cpuPercentMax" DOUBLE PRECISION NOT NULL,
    "stealPercentAvg" DOUBLE PRECISION,
    "iowaitPercentAvg" DOUBLE PRECISION,
    "load1Avg" DOUBLE PRECISION NOT NULL,
    "memoryUsedBytes" BIGINT NOT NULL,
    "memoryTotalBytes" BIGINT NOT NULL,
    "memoryPercentMax" DOUBLE PRECISION NOT NULL,
    "swapUsedBytes" BIGINT NOT NULL,
    "diskUsedBytes" BIGINT NOT NULL,
    "diskTotalBytes" BIGINT NOT NULL,
    "diskPercentMax" DOUBLE PRECISION NOT NULL,
    "inodesPercentMax" DOUBLE PRECISION,
    "diskReadBytesPerSec" DOUBLE PRECISION NOT NULL,
    "diskWriteBytesPerSec" DOUBLE PRECISION NOT NULL,
    "netRxBytesPerSec" DOUBLE PRECISION NOT NULL,
    "netTxBytesPerSec" DOUBLE PRECISION NOT NULL,
    "tcpConnections" INTEGER NOT NULL,
    "processCount" INTEGER NOT NULL,

    CONSTRAINT "OpsServerSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsInstanceSample" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "instanceId" VARCHAR(200) NOT NULL,
    "service" VARCHAR(40) NOT NULL,
    "hostname" VARCHAR(200) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "resolution" "OpsResolution" NOT NULL,
    "bucketStart" BIGINT NOT NULL,
    "cpuPercentAvg" DOUBLE PRECISION NOT NULL,
    "cpuPercentMax" DOUBLE PRECISION NOT NULL,
    "rssBytes" BIGINT NOT NULL,
    "heapUsedBytes" BIGINT NOT NULL,
    "eventLoopLagP99Ms" DOUBLE PRECISION NOT NULL,
    "gcPauseMs" DOUBLE PRECISION NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "serverErrorCount" INTEGER NOT NULL,
    "clientErrorCount" INTEGER NOT NULL,
    "latencyP50Ms" DOUBLE PRECISION,
    "latencyP95Ms" DOUBLE PRECISION,
    "latencyP99Ms" DOUBLE PRECISION,

    CONSTRAINT "OpsInstanceSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsDependencySample" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "dependency" "OpsDependency" NOT NULL,
    "resolution" "OpsResolution" NOT NULL,
    "bucketStart" BIGINT NOT NULL,
    "upPercent" DOUBLE PRECISION NOT NULL,
    "latencyMsAvg" DOUBLE PRECISION,
    "connectionsUsed" INTEGER,
    "sizeBytes" BIGINT,
    "memoryUsedBytes" BIGINT,
    "backlog" INTEGER,
    "failed" INTEGER,

    CONSTRAINT "OpsDependencySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsAlert" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "subjectKind" "OpsAlertSubjectKind" NOT NULL,
    "subjectId" VARCHAR(200) NOT NULL,
    "subjectName" VARCHAR(200) NOT NULL,
    "rule" "OpsAlertRule" NOT NULL,
    "openedAt" BIGINT NOT NULL,
    "resolvedAt" BIGINT,
    "thresholdValue" DOUBLE PRECISION,
    "peakValue" DOUBLE PRECISION,
    "lastValue" DOUBLE PRECISION,
    "message" VARCHAR(500) NOT NULL,
    "openNotifiedAt" BIGINT,
    "resolveNotifiedAt" BIGINT,

    CONSTRAINT "OpsAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsSettings" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "key" VARCHAR(20) NOT NULL,
    "cpuPercent" INTEGER NOT NULL,
    "cpuSustainMinutes" INTEGER NOT NULL,
    "memoryPercent" INTEGER NOT NULL,
    "diskPercent" INTEGER NOT NULL,
    "silentAfterMinutes" INTEGER NOT NULL,
    "tlsWarnDays" INTEGER NOT NULL,
    "extraRecipients" VARCHAR(255)[],
    "backupHour" INTEGER NOT NULL,
    "backupRetentionDays" INTEGER NOT NULL,
    "loadMaxVus" INTEGER NOT NULL,
    "loadMaxRps" INTEGER NOT NULL,
    "loadMaxMinutes" INTEGER NOT NULL,
    "loadMaxSoakMinutes" INTEGER NOT NULL,

    CONSTRAINT "OpsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsBackup" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "status" "OpsBackupStatus" NOT NULL,
    "trigger" "OpsBackupTrigger" NOT NULL,
    "requestedById" TEXT,
    "startedAt" BIGINT,
    "finishedAt" BIGINT,
    "sizeBytes" BIGINT,
    "checksum" VARCHAR(64),
    "storageContainer" VARCHAR(200),
    "storagePath" VARCHAR(500),
    "pgDumpVersion" VARCHAR(100),
    "serverVersion" VARCHAR(100),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "error" VARCHAR(1000),

    CONSTRAINT "OpsBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadTestRun" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "name" VARCHAR(100) NOT NULL,
    "target" "LoadTestTarget" NOT NULL,
    "scenario" VARCHAR(60),
    "endpoint" VARCHAR(300),
    "mixWeights" JSONB,
    "shape" "LoadTestShape" NOT NULL,
    "virtualUsers" INTEGER NOT NULL,
    "requestsPerSecond" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "thresholdP95Ms" INTEGER NOT NULL,
    "thresholdErrorPercent" DOUBLE PRECISION NOT NULL,
    "status" "LoadTestStatus" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "startedAt" BIGINT,
    "finishedAt" BIGINT,
    "abortReason" VARCHAR(300),
    "abortRequestedAt" BIGINT,
    "totalRequests" INTEGER,
    "failedRequests" INTEGER,
    "p50Ms" DOUBLE PRECISION,
    "p95Ms" DOUBLE PRECISION,
    "p99Ms" DOUBLE PRECISION,
    "peakRps" DOUBLE PRECISION,
    "error" VARCHAR(1000),

    CONSTRAINT "LoadTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadTestPoint" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "runId" TEXT NOT NULL,
    "second" INTEGER NOT NULL,
    "at" BIGINT NOT NULL,
    "virtualUsers" INTEGER NOT NULL,
    "requests" INTEGER NOT NULL,
    "failures" INTEGER NOT NULL,
    "p50Ms" DOUBLE PRECISION,
    "p95Ms" DOUBLE PRECISION,
    "p99Ms" DOUBLE PRECISION,

    CONSTRAINT "LoadTestPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadTestStepStat" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "runId" TEXT NOT NULL,
    "step" VARCHAR(100) NOT NULL,
    "requests" INTEGER NOT NULL,
    "failures" INTEGER NOT NULL,
    "p50Ms" DOUBLE PRECISION,
    "p95Ms" DOUBLE PRECISION,
    "p99Ms" DOUBLE PRECISION,

    CONSTRAINT "LoadTestStepStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "recipientUserId" TEXT,
    "recipientKey" VARCHAR(128) NOT NULL,
    "contactAddress" VARCHAR(320),
    "tenantId" TEXT,
    "typeKey" VARCHAR(96) NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "broadcastId" TEXT,
    "groupKey" VARCHAR(160),
    "fannedOutAt" BIGINT,
    "notBefore" BIGINT,
    "attachment" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "notificationId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "tenantId" TEXT,
    "typeKey" VARCHAR(96) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(48),
    "heldUntil" BIGINT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maskedDestination" VARCHAR(160),
    "pushDeviceId" TEXT,
    "providerMessageId" VARCHAR(160),
    "lastError" TEXT,
    "sentAt" BIGINT,
    "deliveredAt" BIGINT,
    "openedAt" BIGINT,
    "fallbackDeliveryId" TEXT,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "notificationId" TEXT,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "surface" "NotificationSurface" NOT NULL,
    "typeKey" VARCHAR(96) NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "richBody" JSONB,
    "link" VARCHAR(500),
    "icon" VARCHAR(48),
    "senderName" VARCHAR(200),
    "senderLogoUrl" VARCHAR(500),
    "attachment" JSONB,
    "groupKey" VARCHAR(160),
    "groupCount" INTEGER NOT NULL DEFAULT 1,
    "broadcastId" TEXT,
    "readAt" BIGINT,
    "archivedAt" BIGINT,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "tenantKey" VARCHAR(64) NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSchedule" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStartMinute" INTEGER NOT NULL DEFAULT 1320,
    "quietEndMinute" INTEGER NOT NULL DEFAULT 420,
    "timeZone" VARCHAR(64) NOT NULL,
    "digestFrequency" "NotificationDigestFrequency" NOT NULL DEFAULT 'OFF',

    CONSTRAINT "NotificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConsent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "scope" "MarketingConsentScope" NOT NULL,
    "tenantId" TEXT,
    "granted" BOOLEAN NOT NULL,
    "source" "MarketingConsentSource" NOT NULL,
    "wordingVersion" VARCHAR(32) NOT NULL,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "occurredAt" BIGINT NOT NULL,

    CONSTRAINT "MarketingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSuppression" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "channel" "NotificationChannel" NOT NULL,
    "destinationHash" VARCHAR(64) NOT NULL,
    "maskedDestination" VARCHAR(160) NOT NULL,
    "cause" "NotificationSuppressionCause" NOT NULL,
    "liftedAt" BIGINT,
    "liftedBy" VARCHAR(128),
    "liftReason" VARCHAR(500),

    CONSTRAINT "NotificationSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "deviceSessionId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "surface" "NotificationSurface" NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "installationIdCiphertext" TEXT,
    "deviceLabel" VARCHAR(120),
    "appVersion" VARCHAR(32),
    "lastSeenAt" BIGINT NOT NULL,
    "revokedAt" BIGINT,
    "revokedReason" VARCHAR(48),

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCustomer" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstClaimedAt" BIGINT NOT NULL,
    "lastClaimedAt" BIGINT NOT NULL,
    "claimCount" INTEGER NOT NULL DEFAULT 1,
    "lastRedeemedAt" BIGINT,
    "leftAt" BIGINT,

    CONSTRAINT "TenantCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "approverUserId" TEXT,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" JSONB NOT NULL,
    "audienceFilter" JSONB NOT NULL,
    "channels" "NotificationChannel"[],
    "sendMode" "BroadcastSendMode" NOT NULL DEFAULT 'INSTANT',
    "sendAt" BIGINT,
    "localSendAt" BIGINT,
    "startsAt" BIGINT,
    "sendingWeek" VARCHAR(8),
    "audienceCount" INTEGER,
    "sendingStartedAt" BIGINT,
    "completedAt" BIGINT,
    "cancelledAt" BIGINT,
    "pausedAt" BIGINT,
    "pauseReason" VARCHAR(200),
    "approvedAt" BIGINT,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastReport" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "broadcastId" TEXT NOT NULL,
    "tenantId" TEXT,
    "reporterUserId" TEXT NOT NULL,
    "reason" "BroadcastReportReason" NOT NULL,
    "note" VARCHAR(500),
    "status" "BroadcastReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedBy" VARCHAR(128),
    "reviewedAt" BIGINT,

    CONSTRAINT "BroadcastReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBroadcastStrike" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "issuedBy" VARCHAR(128) NOT NULL,
    "issuedAt" BIGINT NOT NULL,

    CONSTRAINT "TenantBroadcastStrike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRateLimitOverride" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "policyName" VARCHAR(64) NOT NULL,
    "limit" INTEGER NOT NULL,
    "windowMs" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "setByUserId" TEXT NOT NULL,

    CONSTRAINT "TenantRateLimitOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "payerName" VARCHAR(255) NOT NULL,
    "payerEmail" VARCHAR(320) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "providerPaymentId" VARCHAR(128),
    "checkoutUrl" TEXT,
    "paidAt" BIGINT,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "providerStatus" VARCHAR(64) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "effect" "PaymentEventEffect" NOT NULL,
    "amountMinor" INTEGER,
    "occurredAt" BIGINT NOT NULL,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLegalHold" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" VARCHAR(64),
    "userId" VARCHAR(64),
    "reason" VARCHAR(500) NOT NULL,
    "placedByUserId" VARCHAR(64) NOT NULL,
    "placedAt" BIGINT NOT NULL,
    "liftedAt" BIGINT,
    "liftedByUserId" VARCHAR(64),

    CONSTRAINT "AuditLegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionRun" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "target" "RetentionTarget" NOT NULL,
    "cutoff" BIGINT NOT NULL,
    "dryRun" BOOLEAN NOT NULL,
    "deletedCount" INTEGER NOT NULL,
    "heldBackCount" INTEGER NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "finishedAt" BIGINT NOT NULL,
    "outcome" "RetentionRunOutcome" NOT NULL,
    "failureReason" VARCHAR(500),

    CONSTRAINT "RetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountErasure" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" VARCHAR(64) NOT NULL,
    "status" "AccountErasureStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500),
    "requestedAt" BIGINT NOT NULL,
    "scheduledFor" BIGINT NOT NULL,
    "cancelledAt" BIGINT,
    "cancelledByUserId" VARCHAR(64),
    "completedAt" BIGINT,

    CONSTRAINT "AccountErasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagSetting" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "key" VARCHAR(64) NOT NULL,
    "mode" "FeatureFlagMode" NOT NULL,
    "percentage" INTEGER,
    "reason" VARCHAR(500) NOT NULL,

    CONSTRAINT "FeatureFlagSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagStoreOverride" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "key" VARCHAR(64) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "enabled" BOOLEAN NOT NULL,
    "reason" VARCHAR(500) NOT NULL,

    CONSTRAINT "FeatureFlagStoreOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListView" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "userId" TEXT NOT NULL,
    "listKey" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "query" VARCHAR(2000) NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SavedListView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusIncident" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "title" VARCHAR(160) NOT NULL,
    "impact" "StatusIncidentImpact" NOT NULL,
    "state" "StatusIncidentState" NOT NULL,
    "components" VARCHAR(40)[],
    "startedAt" BIGINT NOT NULL,
    "resolvedAt" BIGINT,
    "openedById" TEXT NOT NULL,

    CONSTRAINT "StatusIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusIncidentUpdate" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "incidentId" TEXT NOT NULL,
    "state" "StatusIncidentState" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "postedById" TEXT NOT NULL,
    "postedAt" BIGINT NOT NULL,

    CONSTRAINT "StatusIncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsRestoreDrill" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "backupId" VARCHAR(64) NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "finishedAt" BIGINT NOT NULL,
    "outcome" "OpsRestoreDrillOutcome" NOT NULL,
    "tablesChecked" INTEGER NOT NULL,
    "rowsRestored" BIGINT NOT NULL,
    "failures" JSONB NOT NULL,
    "migration" VARCHAR(255),

    CONSTRAINT "OpsRestoreDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "description" VARCHAR(200) NOT NULL DEFAULT '',
    "eventTypes" VARCHAR(64)[],
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabledReason" "WebhookEndpointDisabledReason",
    "disabledAt" BIGINT,
    "secretCiphertext" TEXT NOT NULL,
    "secretHint" VARCHAR(4) NOT NULL,
    "previousSecretCiphertext" TEXT,
    "previousSecretExpiresAt" BIGINT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" BIGINT,
    "createdByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "apiVersion" VARCHAR(16) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" BIGINT NOT NULL,
    "fannedOutAt" BIGINT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" BIGINT,
    "lastAttemptAt" BIGINT,
    "lastStatusCode" INTEGER,
    "lastError" VARCHAR(500),
    "lastDurationMs" INTEGER,
    "deliveredAt" BIGINT,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_pendingAttributionToken_idx" ON "User"("pendingAttributionToken");

-- CreateIndex
CREATE INDEX "User_authorizationChangedAt_idx" ON "User"("authorizationChangedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_id_idx" ON "User"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenDigest_key" ON "PasswordResetToken"("tokenDigest");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenDigest_idx" ON "PasswordResetToken"("tokenDigest");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BackupCode_userId_idx" ON "BackupCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorPendingSetup_userId_key" ON "TwoFactorPendingSetup"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorPendingSetup_expiresAt_idx" ON "TwoFactorPendingSetup"("expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorLoginChallenge_expiresAt_idx" ON "TwoFactorLoginChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorLoginChallenge_userId_idx" ON "TwoFactorLoginChallenge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_isDeleted_idx" ON "WebAuthnCredential"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_userId_idx" ON "WebAuthnChallenge"("userId");

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_loginChallengeId_idx" ON "WebAuthnChallenge"("loginChallengeId");

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "MfaRecoveryRequest_userId_idx" ON "MfaRecoveryRequest"("userId");

-- CreateIndex
CREATE INDEX "MfaRecoveryRequest_status_idx" ON "MfaRecoveryRequest"("status");

-- CreateIndex
CREATE INDEX "MfaRecoveryAuditLog_requestId_createdAt_idx" ON "MfaRecoveryAuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "MfaRecoveryAuditLog_subjectUserId_idx" ON "MfaRecoveryAuditLog"("subjectUserId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_lastActiveAt_id_idx" ON "RefreshToken"("userId", "lastActiveAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "ImpersonationAuditLog_impersonatorId_idx" ON "ImpersonationAuditLog"("impersonatorId");

-- CreateIndex
CREATE INDEX "ImpersonationAuditLog_targetUserId_idx" ON "ImpersonationAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "ImpersonationAuditLog_sessionId_idx" ON "ImpersonationAuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "ImpersonationAuditLog_createdAt_idx" ON "ImpersonationAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_impersonatorId_endedAt_idx" ON "ImpersonationSession"("impersonatorId", "endedAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetUserId_idx" ON "ImpersonationSession"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvatar_userId_key" ON "UserAvatar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvatar_fileId_key" ON "UserAvatar"("fileId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_isDeleted_idx" ON "UserPreference"("userId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "Role_kind_idx" ON "Role"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_resource_scope_key" ON "Permission"("action", "resource", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityDefinition_slug_key" ON "CapabilityDefinition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityDefinition_permissionId_key" ON "CapabilityDefinition"("permissionId");

-- CreateIndex
CREATE INDEX "CapabilityDefinition_scope_idx" ON "CapabilityDefinition"("scope");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_actorId_idx" ON "PermissionAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_targetUserId_idx" ON "PermissionAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_targetRoleId_idx" ON "PermissionAuditLog"("targetRoleId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_createdAt_idx" ON "PermissionAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_correlationId_idx" ON "PermissionAuditLog"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "UserPermission_userId_permissionId_idx" ON "UserPermission"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_tenantId_idx" ON "UserPermission"("tenantId");

-- CreateIndex
CREATE INDEX "UserPermission_locationId_idx" ON "UserPermission"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "ResourceAcl_membershipId_idx" ON "ResourceAcl"("membershipId");

-- CreateIndex
CREATE INDEX "ResourceAcl_subjectType_subjectId_idx" ON "ResourceAcl"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ResourceAcl_resourceType_resourceId_idx" ON "ResourceAcl"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceAcl_tenantId_idx" ON "ResourceAcl"("tenantId");

-- CreateIndex
CREATE INDEX "ResourceAcl_locationId_idx" ON "ResourceAcl"("locationId");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_actorId_idx" ON "AuthorizationAudit"("actorId");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_tenantId_idx" ON "AuthorizationAudit"("tenantId");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_locationId_idx" ON "AuthorizationAudit"("locationId");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_decision_idx" ON "AuthorizationAudit"("decision");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_action_idx" ON "AuthorizationAudit"("action");

-- CreateIndex
CREATE INDEX "AuthorizationAudit_createdAt_idx" ON "AuthorizationAudit"("createdAt");

-- CreateIndex
CREATE INDEX "SupportAccessGrant_tenantId_status_idx" ON "SupportAccessGrant"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SupportAccessGrant_supportUserId_status_idx" ON "SupportAccessGrant"("supportUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_lifecycleState_idx" ON "Tenant"("lifecycleState");

-- CreateIndex
CREATE INDEX "TenantSlugHistory_tenantId_idx" ON "TenantSlugHistory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSlugHistory_slug_key" ON "TenantSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "Location_tenantId_idx" ON "Location"("tenantId");

-- CreateIndex
CREATE INDEX "Location_tenantId_status_idx" ON "Location"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_code_key" ON "Location"("tenantId", "code") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_key" ON "Location"("tenantId") WHERE ("isPrimary" = true AND "isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_id_key" ON "Location"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_roleId_idx" ON "Membership"("roleId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_status_idx" ON "Membership"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Membership_tenantId_createdAt_id_idx" ON "Membership"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Membership_userId_createdAt_id_idx" ON "Membership"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_id_key" ON "Membership"("tenantId", "id");

-- CreateIndex
CREATE INDEX "MembershipLocationScope_tenantId_idx" ON "MembershipLocationScope"("tenantId");

-- CreateIndex
CREATE INDEX "MembershipLocationScope_roleId_idx" ON "MembershipLocationScope"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipLocationScope_membershipId_locationId_key" ON "MembershipLocationScope"("membershipId", "locationId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "TenantMerchantProfile_tenantId_key" ON "TenantMerchantProfile"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMerchantProfile_kybStatus_idx" ON "TenantMerchantProfile"("kybStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantInvitation_email_idx" ON "TenantInvitation"("email");

-- CreateIndex
CREATE INDEX "TenantInvitation_tenantId_idx" ON "TenantInvitation"("tenantId");

-- CreateIndex
CREATE INDEX "TenantInvitation_tenantId_kind_status_idx" ON "TenantInvitation"("tenantId", "kind", "status");

-- CreateIndex
CREATE INDEX "TenantInvitation_tenantId_kind_status_createdAt_id_idx" ON "TenantInvitation"("tenantId", "kind", "status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitation_tenantId_email_kind_key" ON "TenantInvitation"("tenantId", "email", "kind") WHERE ("status" = 'PENDING');

-- CreateIndex
CREATE INDEX "TenantInvitationLocationScope_tenantId_idx" ON "TenantInvitationLocationScope"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitationLocationScope_invitationId_locationId_key" ON "TenantInvitationLocationScope"("invitationId", "locationId");

-- CreateIndex
CREATE INDEX "TenantAccessRequest_tenantId_userId_status_idx" ON "TenantAccessRequest"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "TenantAccessRequest_tenantId_status_idx" ON "TenantAccessRequest"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAccessRequest_tenantId_userId_key" ON "TenantAccessRequest"("tenantId", "userId") WHERE ("status" = 'PENDING');

-- CreateIndex
CREATE INDEX "TenantSuspensionAppeal_tenantId_createdAt_idx" ON "TenantSuspensionAppeal"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantSuspensionAppeal_status_createdAt_idx" ON "TenantSuspensionAppeal"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSuspensionAppeal_tenantId_key" ON "TenantSuspensionAppeal"("tenantId") WHERE ("status" = 'PENDING' AND "isDeleted" = false);

-- CreateIndex
CREATE INDEX "TenantCustomerBan_tenantId_bannedAt_idx" ON "TenantCustomerBan"("tenantId", "bannedAt");

-- CreateIndex
CREATE INDEX "TenantCustomerBan_customerUserId_idx" ON "TenantCustomerBan"("customerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCustomerBan_tenantId_customerUserId_key" ON "TenantCustomerBan"("tenantId", "customerUserId") WHERE ("liftedAt" IS NULL AND "isDeleted" = false);

-- CreateIndex
CREATE INDEX "TenantLifecycleEvent_tenantId_createdAt_idx" ON "TenantLifecycleEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPlacement_tenantId_key" ON "TenantPlacement"("tenantId");

-- CreateIndex
CREATE INDEX "TenantEncryptionKey_kmsKeyId_idx" ON "TenantEncryptionKey"("kmsKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEncryptionKey_tenantId_keyVersion_key" ON "TenantEncryptionKey"("tenantId", "keyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEncryptionKey_tenantId_key" ON "TenantEncryptionKey"("tenantId") WHERE ("status" = 'ACTIVE');

-- CreateIndex
CREATE INDEX "TenantAuditLog_tenantId_createdAt_idx" ON "TenantAuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantAuditLog_tenantId_action_idx" ON "TenantAuditLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "TenantAsset_fileId_idx" ON "TenantAsset"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAsset_tenantId_assetType_key" ON "TenantAsset"("tenantId", "assetType");

-- CreateIndex
CREATE INDEX "TenantKybFile_tenantId_idx" ON "TenantKybFile"("tenantId");

-- CreateIndex
CREATE INDEX "TenantKybFile_tenantId_isActive_idx" ON "TenantKybFile"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TenantKybFile_submissionId_idx" ON "TenantKybFile"("submissionId");

-- CreateIndex
CREATE INDEX "TenantKybFile_fileId_idx" ON "TenantKybFile"("fileId");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedById_idx" ON "StoredFile"("uploadedById");

-- CreateIndex
CREATE INDEX "StoredFile_tenantId_idx" ON "StoredFile"("tenantId");

-- CreateIndex
CREATE INDEX "StoredFile_productId_idx" ON "StoredFile"("productId");

-- CreateIndex
CREATE INDEX "StoredFile_status_idx" ON "StoredFile"("status");

-- CreateIndex
CREATE INDEX "StoredFile_category_idx" ON "StoredFile"("category");

-- CreateIndex
CREATE INDEX "FileVariant_fileId_idx" ON "FileVariant"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FileVariant_fileId_kind_key" ON "FileVariant"("fileId", "kind");

-- CreateIndex
CREATE INDEX "Reward_tenantId_idx" ON "Reward"("tenantId");

-- CreateIndex
CREATE INDEX "Reward_tenantId_createdAt_id_idx" ON "Reward"("tenantId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Reward_status_idx" ON "Reward"("status");

-- CreateIndex
CREATE INDEX "Reward_category_idx" ON "Reward"("category");

-- CreateIndex
CREATE INDEX "Reward_expiryDate_idx" ON "Reward"("expiryDate");

-- CreateIndex
CREATE INDEX "Reward_autoPublishAt_idx" ON "Reward"("autoPublishAt");

-- CreateIndex
CREATE INDEX "Reward_rewardKind_idx" ON "Reward"("rewardKind");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_tenantId_id_key" ON "Reward"("tenantId", "id");

-- CreateIndex
CREATE INDEX "RewardImage_rewardId_idx" ON "RewardImage"("rewardId");

-- CreateIndex
CREATE INDEX "RewardImage_fileId_idx" ON "RewardImage"("fileId");

-- CreateIndex
CREATE INDEX "RewardImage_tenantId_idx" ON "RewardImage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardImage_rewardId_position_key" ON "RewardImage"("rewardId", "position") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "RewardImage_rewardId_fileId_key" ON "RewardImage"("rewardId", "fileId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "RewardLocationScope_tenantId_idx" ON "RewardLocationScope"("tenantId");

-- CreateIndex
CREATE INDEX "RewardLocationScope_locationId_idx" ON "RewardLocationScope"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLocationScope_rewardId_locationId_key" ON "RewardLocationScope"("rewardId", "locationId");

-- CreateIndex
CREATE INDEX "RewardAudienceMember_tenantId_idx" ON "RewardAudienceMember"("tenantId");

-- CreateIndex
CREATE INDEX "RewardAudienceMember_userId_idx" ON "RewardAudienceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAudienceMember_rewardId_userId_key" ON "RewardAudienceMember"("rewardId", "userId");

-- CreateIndex
CREATE INDEX "RewardLegalAcceptance_userId_idx" ON "RewardLegalAcceptance"("userId");

-- CreateIndex
CREATE INDEX "RewardAuditLog_tenantId_idx" ON "RewardAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "RewardAuditLog_action_idx" ON "RewardAuditLog"("action");

-- CreateIndex
CREATE INDEX "RewardAuditLog_createdAt_idx" ON "RewardAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_redemptionTokenHash_key" ON "RewardClaim"("redemptionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_backupCodeHash_key" ON "RewardClaim"("backupCodeHash");

-- CreateIndex
CREATE INDEX "RewardClaim_userId_idx" ON "RewardClaim"("userId");

-- CreateIndex
CREATE INDEX "RewardClaim_rewardId_idx" ON "RewardClaim"("rewardId");

-- CreateIndex
CREATE INDEX "RewardClaim_status_idx" ON "RewardClaim"("status");

-- CreateIndex
CREATE INDEX "RewardClaim_claimExpiresAt_idx" ON "RewardClaim"("claimExpiresAt");

-- CreateIndex
CREATE INDEX "RewardClaim_rewardId_claimedAt_idx" ON "RewardClaim"("rewardId", "claimedAt");

-- CreateIndex
CREATE INDEX "RewardClaim_userId_claimedAt_idx" ON "RewardClaim"("userId", "claimedAt");

-- CreateIndex
CREATE INDEX "RewardClaim_claimedAt_idx" ON "RewardClaim"("claimedAt");

-- CreateIndex
CREATE INDEX "RewardClaimHold_userId_status_idx" ON "RewardClaimHold"("userId", "status");

-- CreateIndex
CREATE INDEX "RewardClaimHold_rewardId_userId_idx" ON "RewardClaimHold"("rewardId", "userId");

-- CreateIndex
CREATE INDEX "RewardClaimHold_status_expiresAt_idx" ON "RewardClaimHold"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "RewardOtpChallenge_userId_idx" ON "RewardOtpChallenge"("userId");

-- CreateIndex
CREATE INDEX "RewardOtpChallenge_phone_idx" ON "RewardOtpChallenge"("phone");

-- CreateIndex
CREATE INDEX "RewardOtpChallenge_expiresAt_idx" ON "RewardOtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "RewardNotification_userId_idx" ON "RewardNotification"("userId");

-- CreateIndex
CREATE INDEX "RewardNotification_userId_readAt_idx" ON "RewardNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "RewardNotification_userId_createdAt_id_idx" ON "RewardNotification"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "RewardNotification_createdAt_idx" ON "RewardNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardReferral_attributionToken_key" ON "RewardReferral"("attributionToken");

-- CreateIndex
CREATE INDEX "RewardReferral_referrerUserId_idx" ON "RewardReferral"("referrerUserId");

-- CreateIndex
CREATE INDEX "RewardReferral_refereeUserId_idx" ON "RewardReferral"("refereeUserId");

-- CreateIndex
CREATE INDEX "RewardReferral_rewardId_idx" ON "RewardReferral"("rewardId");

-- CreateIndex
CREATE INDEX "RewardReferral_status_idx" ON "RewardReferral"("status");

-- CreateIndex
CREATE INDEX "RewardReferral_status_creditNotifiedAt_idx" ON "RewardReferral"("status", "creditNotifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignupReferralCode_code_key" ON "SignupReferralCode"("code");

-- CreateIndex
CREATE INDEX "SignupReferralCode_userId_createdAt_idx" ON "SignupReferralCode"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignupReferral_refereeUserId_key" ON "SignupReferral"("refereeUserId");

-- CreateIndex
CREATE INDEX "SignupReferral_referrerUserId_createdAt_idx" ON "SignupReferral"("referrerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SignupReferral_successNotifiedAt_successfulAt_idx" ON "SignupReferral"("successNotifiedAt", "successfulAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantApiKey_keyHash_key" ON "TenantApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "TenantApiKey_tenantId_idx" ON "TenantApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "TenantApiKey_locationId_idx" ON "TenantApiKey"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantApiKey_tenantId_id_key" ON "TenantApiKey"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTerminal_apiKeyId_key" ON "TenantTerminal"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTerminal_pairingCodeHash_key" ON "TenantTerminal"("pairingCodeHash");

-- CreateIndex
CREATE INDEX "TenantTerminal_locationId_idx" ON "TenantTerminal"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTerminal_tenantId_terminalId_key" ON "TenantTerminal"("tenantId", "terminalId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE UNIQUE INDEX "TenantTerminal_tenantId_apiKeyId_key" ON "TenantTerminal"("tenantId", "apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_claimId_key" ON "RewardRedemption"("claimId");

-- CreateIndex
CREATE INDEX "RewardRedemption_tenantId_idx" ON "RewardRedemption"("tenantId");

-- CreateIndex
CREATE INDEX "RewardRedemption_locationId_idx" ON "RewardRedemption"("locationId");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_idx" ON "RewardRedemption"("userId");

-- CreateIndex
CREATE INDEX "RewardRedemption_redeemedAt_idx" ON "RewardRedemption"("redeemedAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_saleId_idx" ON "RewardRedemption"("saleId");

-- CreateIndex
CREATE INDEX "RewardRedemption_tenantId_redeemedAt_idx" ON "RewardRedemption"("tenantId", "redeemedAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_redeemedAt_idx" ON "RewardRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "RewardSale_tenantId_paidAt_idx" ON "RewardSale"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "RewardSale_userId_paidAt_idx" ON "RewardSale"("userId", "paidAt");

-- CreateIndex
CREATE INDEX "RewardSale_locationId_idx" ON "RewardSale"("locationId");

-- CreateIndex
CREATE INDEX "RewardSale_paidAt_idx" ON "RewardSale"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardSale_tenantId_idempotencyKey_key" ON "RewardSale"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_fileId_idx" ON "ProductImage"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_key" ON "ProductImage"("productId") WHERE ("isPrimary" = true AND "isDeleted" = false);

-- CreateIndex
CREATE INDEX "KanbanColumn_board_isDeleted_position_idx" ON "KanbanColumn"("board", "isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanPlanningColumn_isDeleted_position_idx" ON "KanbanPlanningColumn"("isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanExecutionColumn_isDeleted_position_idx" ON "KanbanExecutionColumn"("isDeleted", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanLevelCounter_level_key" ON "KanbanLevelCounter"("level");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanConversionStage_stage_key" ON "KanbanConversionStage"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanTask_key_key" ON "KanbanTask"("key");

-- CreateIndex
CREATE INDEX "KanbanTask_columnId_isDeleted_position_idx" ON "KanbanTask"("columnId", "isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanTask_planningColumnId_isDeleted_position_idx" ON "KanbanTask"("planningColumnId", "isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanTask_executionColumnId_isDeleted_position_idx" ON "KanbanTask"("executionColumnId", "isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanTask_parentId_isDeleted_idx" ON "KanbanTask"("parentId", "isDeleted");

-- CreateIndex
CREATE INDEX "KanbanTask_ownerId_idx" ON "KanbanTask"("ownerId");

-- CreateIndex
CREATE INDEX "KanbanTask_assigneeId_idx" ON "KanbanTask"("assigneeId");

-- CreateIndex
CREATE INDEX "KanbanTaskComment_taskId_isDeleted_createdAt_idx" ON "KanbanTaskComment"("taskId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskComment_authorId_idx" ON "KanbanTaskComment"("authorId");

-- CreateIndex
CREATE INDEX "KanbanTaskAttachment_taskId_isDeleted_createdAt_idx" ON "KanbanTaskAttachment"("taskId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskAttachment_commentId_idx" ON "KanbanTaskAttachment"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanTaskAttachment_fileId_key" ON "KanbanTaskAttachment"("fileId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "KanbanChecklistItem_taskId_list_isDeleted_position_idx" ON "KanbanChecklistItem"("taskId", "list", "isDeleted", "position");

-- CreateIndex
CREATE INDEX "KanbanChecklistItem_assigneeId_idx" ON "KanbanChecklistItem"("assigneeId");

-- CreateIndex
CREATE INDEX "KanbanTaskWatcher_userId_idx" ON "KanbanTaskWatcher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanTaskWatcher_taskId_userId_key" ON "KanbanTaskWatcher"("taskId", "userId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "KanbanTaskLink_targetTaskId_isDeleted_idx" ON "KanbanTaskLink"("targetTaskId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanTaskLink_sourceTaskId_targetTaskId_kind_key" ON "KanbanTaskLink"("sourceTaskId", "targetTaskId", "kind") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "KanbanTaskActivity_taskId_createdAt_idx" ON "KanbanTaskActivity"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskActivity_actorId_idx" ON "KanbanTaskActivity"("actorId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_templateKey_idx" ON "EmailLog"("templateKey");

-- CreateIndex
CREATE INDEX "EmailLog_to_idx" ON "EmailLog"("to");

-- CreateIndex
CREATE INDEX "EmailLog_resendId_idx" ON "EmailLog"("resendId");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryEvent_webhookId_key" ON "EmailDeliveryEvent"("webhookId");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_resendId_idx" ON "EmailDeliveryEvent"("resendId");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_emailLogId_occurredAt_idx" ON "EmailDeliveryEvent"("emailLogId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_createdAt_idx" ON "EmailDeliveryEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Region_name_idx" ON "Region" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Subregion_regionId_idx" ON "Subregion"("regionId");

-- CreateIndex
CREATE INDEX "Subregion_name_idx" ON "Subregion" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Country_regionId_idx" ON "Country"("regionId");

-- CreateIndex
CREATE INDEX "Country_subregionId_idx" ON "Country"("subregionId");

-- CreateIndex
CREATE INDEX "Country_name_idx" ON "Country" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "State_countryId_idx" ON "State"("countryId");

-- CreateIndex
CREATE INDEX "State_name_idx" ON "State" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "City_stateId_idx" ON "City"("stateId");

-- CreateIndex
CREATE INDEX "City_countryId_idx" ON "City"("countryId");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "GithubAccountLink_userId_key" ON "GithubAccountLink"("userId");

-- CreateIndex
CREATE INDEX "GithubWebhookSubscription_createdBy_idx" ON "GithubWebhookSubscription"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "GithubWebhookSubscription_owner_repository_key" ON "GithubWebhookSubscription"("owner", "repository");

-- CreateIndex
CREATE INDEX "GithubWebhookDelivery_receivedAt_idx" ON "GithubWebhookDelivery"("receivedAt");

-- CreateIndex
CREATE INDEX "ReceivedWebhook_receivedAt_id_idx" ON "ReceivedWebhook"("receivedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "ReceivedWebhook_provider_receivedAt_idx" ON "ReceivedWebhook"("provider", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "ReceivedWebhook_outcome_receivedAt_idx" ON "ReceivedWebhook"("outcome", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "ReceivedWebhook_lastReceivedAt_idx" ON "ReceivedWebhook"("lastReceivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivedWebhook_provider_providerDeliveryId_key" ON "ReceivedWebhook"("provider", "providerDeliveryId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "InboxProcessedEvent_processedAt_idx" ON "InboxProcessedEvent"("processedAt");

-- CreateIndex
CREATE INDEX "InboxDeadLetter_consumer_receivedAt_idx" ON "InboxDeadLetter"("consumer", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxDeadLetter_consumer_topic_partition_offset_key" ON "InboxDeadLetter"("consumer", "topic", "partition", "offset");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_topic_occurredAt_idx" ON "AnalyticsEvent"("topic", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_occurredAt_idx" ON "AuditLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_impersonatorUserId_occurredAt_idx" ON "AuditLog"("impersonatorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_occurredAt_idx" ON "AuditLog"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_outcome_occurredAt_idx" ON "AuditLog"("outcome", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_deviceType_occurredAt_idx" ON "AuditLog"("deviceType", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_path_idx" ON "AuditLog" USING GIN ("path" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AuditLog_endpoint_idx" ON "AuditLog" USING GIN ("endpoint" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AuditLog_errorCode_idx" ON "AuditLog" USING GIN ("errorCode" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AuditLog_ipAddress_idx" ON "AuditLog" USING GIN ("ipAddress" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AuditLog_userAgent_idx" ON "AuditLog" USING GIN ("userAgent" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataChangeLog_changeSequence_key" ON "DataChangeLog"("changeSequence");

-- CreateIndex
CREATE INDEX "DataChangeLog_occurredAt_idx" ON "DataChangeLog"("occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeLog_correlationId_idx" ON "DataChangeLog"("correlationId");

-- CreateIndex
CREATE INDEX "DataChangeLog_tableName_rowId_occurredAt_idx" ON "DataChangeLog"("tableName", "rowId", "occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeLog_actorUserId_occurredAt_idx" ON "DataChangeLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeLog_tenantId_occurredAt_idx" ON "DataChangeLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeLog_actorKind_occurredAt_idx" ON "DataChangeLog"("actorKind", "occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeLog_transactionId_idx" ON "DataChangeLog"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DataChangeGroup_groupKey_key" ON "DataChangeGroup"("groupKey");

-- CreateIndex
CREATE INDEX "DataChangeGroup_occurredAt_idx" ON "DataChangeGroup"("occurredAt");

-- CreateIndex
CREATE INDEX "DataChangeGroup_correlationId_idx" ON "DataChangeGroup"("correlationId");

-- CreateIndex
CREATE INDEX "PlatformResourceIdempotencyRecord_expiresAt_idx" ON "PlatformResourceIdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformResourceIdempotencyRecord_scope_idempotencyKey_key" ON "PlatformResourceIdempotencyRecord"("scope", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OpsServer_agentTokenHash_key" ON "OpsServer"("agentTokenHash");

-- CreateIndex
CREATE INDEX "OpsServer_isDeleted_name_idx" ON "OpsServer"("isDeleted", "name");

-- CreateIndex
CREATE INDEX "OpsServerSample_resolution_bucketStart_idx" ON "OpsServerSample"("resolution", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "OpsServerSample_serverId_resolution_bucketStart_key" ON "OpsServerSample"("serverId", "resolution", "bucketStart");

-- CreateIndex
CREATE INDEX "OpsInstanceSample_resolution_bucketStart_idx" ON "OpsInstanceSample"("resolution", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "OpsInstanceSample_instanceId_resolution_bucketStart_key" ON "OpsInstanceSample"("instanceId", "resolution", "bucketStart");

-- CreateIndex
CREATE INDEX "OpsDependencySample_resolution_bucketStart_idx" ON "OpsDependencySample"("resolution", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "OpsDependencySample_dependency_resolution_bucketStart_key" ON "OpsDependencySample"("dependency", "resolution", "bucketStart");

-- CreateIndex
CREATE INDEX "OpsAlert_resolvedAt_openedAt_idx" ON "OpsAlert"("resolvedAt", "openedAt");

-- CreateIndex
CREATE INDEX "OpsAlert_subjectKind_subjectId_rule_resolvedAt_idx" ON "OpsAlert"("subjectKind", "subjectId", "rule", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsSettings_key_key" ON "OpsSettings"("key");

-- CreateIndex
CREATE INDEX "OpsBackup_isDeleted_createdAt_idx" ON "OpsBackup"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "OpsBackup_status_idx" ON "OpsBackup"("status");

-- CreateIndex
CREATE INDEX "LoadTestRun_isDeleted_createdAt_idx" ON "LoadTestRun"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "LoadTestRun_status_idx" ON "LoadTestRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LoadTestPoint_runId_second_key" ON "LoadTestPoint"("runId", "second");

-- CreateIndex
CREATE UNIQUE INDEX "LoadTestStepStat_runId_step_key" ON "LoadTestStepStat"("runId", "step");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_broadcastId_idx" ON "Notification"("broadcastId");

-- CreateIndex
CREATE INDEX "Notification_fannedOutAt_idx" ON "Notification"("fannedOutAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientKey_typeKey_dedupeKey_key" ON "Notification"("recipientKey", "typeKey", "dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_heldUntil_idx" ON "NotificationDelivery"("status", "heldUntil");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_createdAt_idx" ON "NotificationDelivery"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientUserId_createdAt_idx" ON "NotificationDelivery"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_status_createdAt_idx" ON "NotificationDelivery"("channel", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_providerMessageId_idx" ON "NotificationDelivery"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_pushDeviceId_key" ON "NotificationDelivery"("notificationId", "channel", "pushDeviceId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_surface_createdAt_id_idx" ON "InAppNotification"("userId", "surface", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "InAppNotification_userId_surface_readAt_idx" ON "InAppNotification"("userId", "surface", "readAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_groupKey_idx" ON "InAppNotification"("userId", "groupKey");

-- CreateIndex
CREATE INDEX "InAppNotification_createdAt_idx" ON "InAppNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_tenantKey_category_channel_key" ON "NotificationPreference"("userId", "tenantKey", "category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSchedule_userId_key" ON "NotificationSchedule"("userId");

-- CreateIndex
CREATE INDEX "MarketingConsent_userId_scope_tenantId_occurredAt_idx" ON "MarketingConsent"("userId", "scope", "tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "MarketingConsent_tenantId_occurredAt_idx" ON "MarketingConsent"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationSuppression_destinationHash_idx" ON "NotificationSuppression"("destinationHash");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSuppression_channel_destinationHash_key" ON "NotificationSuppression"("channel", "destinationHash") WHERE ("liftedAt" IS NULL AND "isDeleted" = false);

-- CreateIndex
CREATE INDEX "PushDevice_userId_revokedAt_idx" ON "PushDevice"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "PushDevice_deviceSessionId_idx" ON "PushDevice"("deviceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_tokenHash_key" ON "PushDevice"("tokenHash") WHERE ("revokedAt" IS NULL AND "isDeleted" = false);

-- CreateIndex
CREATE INDEX "TenantCustomer_tenantId_lastClaimedAt_idx" ON "TenantCustomer"("tenantId", "lastClaimedAt" DESC);

-- CreateIndex
CREATE INDEX "TenantCustomer_userId_idx" ON "TenantCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCustomer_tenantId_userId_key" ON "TenantCustomer"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Broadcast_tenantId_status_createdAt_idx" ON "Broadcast"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Broadcast_status_startsAt_idx" ON "Broadcast"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Broadcast_tenantId_sendingWeek_idx" ON "Broadcast"("tenantId", "sendingWeek");

-- CreateIndex
CREATE INDEX "BroadcastReport_status_createdAt_idx" ON "BroadcastReport"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BroadcastReport_tenantId_createdAt_idx" ON "BroadcastReport"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastReport_broadcastId_reporterUserId_key" ON "BroadcastReport"("broadcastId", "reporterUserId");

-- CreateIndex
CREATE INDEX "TenantBroadcastStrike_tenantId_issuedAt_idx" ON "TenantBroadcastStrike"("tenantId", "issuedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBroadcastStrike_tenantId_broadcastId_key" ON "TenantBroadcastStrike"("tenantId", "broadcastId");

-- CreateIndex
CREATE INDEX "TenantRateLimitOverride_expiresAt_idx" ON "TenantRateLimitOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRateLimitOverride_tenantId_policyName_key" ON "TenantRateLimitOverride"("tenantId", "policyName") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_createdAt_idx" ON "PaymentIntent"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PaymentIntent_status_createdAt_idx" ON "PaymentIntent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_tenantId_idempotencyKey_key" ON "PaymentIntent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_provider_providerPaymentId_key" ON "PaymentIntent"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentIntentId_occurredAt_idx" ON "PaymentEvent"("paymentIntentId", "occurredAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_tenantId_occurredAt_idx" ON "PaymentEvent"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLegalHold_liftedAt_idx" ON "AuditLegalHold"("liftedAt");

-- CreateIndex
CREATE INDEX "RetentionRun_target_startedAt_idx" ON "RetentionRun"("target", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "AccountErasure_status_scheduledFor_idx" ON "AccountErasure"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "AccountErasure_userId_key" ON "AccountErasure"("userId") WHERE ("status" = 'PENDING');

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagSetting_key_key" ON "FeatureFlagSetting"("key") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "FeatureFlagStoreOverride_tenantId_isDeleted_idx" ON "FeatureFlagStoreOverride"("tenantId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagStoreOverride_key_tenantId_key" ON "FeatureFlagStoreOverride"("key", "tenantId") WHERE ("isDeleted" = false AND "locationId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagStoreOverride_key_tenantId_locationId_key" ON "FeatureFlagStoreOverride"("key", "tenantId", "locationId") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "SavedListView_listKey_shared_isDeleted_idx" ON "SavedListView"("listKey", "shared", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListView_userId_listKey_name_key" ON "SavedListView"("userId", "listKey", "name") WHERE ("isDeleted" = false);

-- CreateIndex
CREATE INDEX "StatusIncident_isDeleted_resolvedAt_startedAt_idx" ON "StatusIncident"("isDeleted", "resolvedAt", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "StatusIncidentUpdate_incidentId_postedAt_idx" ON "StatusIncidentUpdate"("incidentId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "OpsRestoreDrill_startedAt_idx" ON "OpsRestoreDrill"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "WebhookEndpoint_tenantId_isDeleted_createdAt_idx" ON "WebhookEndpoint"("tenantId", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_tenantId_id_key" ON "WebhookEndpoint"("tenantId", "id");

-- CreateIndex
CREATE INDEX "WebhookEvent_fannedOutAt_occurredAt_idx" ON "WebhookEvent"("fannedOutAt", "occurredAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_tenantId_id_key" ON "WebhookEvent"("tenantId", "id");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_tenantId_createdAt_id_idx" ON "WebhookDelivery"("tenantId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_endpointId_eventId_key" ON "WebhookDelivery"("endpointId", "eventId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupCode" ADD CONSTRAINT "BackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorPendingSetup" ADD CONSTRAINT "TwoFactorPendingSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorLoginChallenge" ADD CONSTRAINT "TwoFactorLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnChallenge" ADD CONSTRAINT "WebAuthnChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnChallenge" ADD CONSTRAINT "WebAuthnChallenge_loginChallengeId_fkey" FOREIGN KEY ("loginChallengeId") REFERENCES "TwoFactorLoginChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryRequest" ADD CONSTRAINT "MfaRecoveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationAuditLog" ADD CONSTRAINT "ImpersonationAuditLog_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationAuditLog" ADD CONSTRAINT "ImpersonationAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationAuditLog" ADD CONSTRAINT "ImpersonationAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImpersonationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityDefinition" ADD CONSTRAINT "CapabilityDefinition_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAcl" ADD CONSTRAINT "ResourceAcl_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_supportUserId_fkey" FOREIGN KEY ("supportUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSlugHistory" ADD CONSTRAINT "TenantSlugHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocationScope" ADD CONSTRAINT "MembershipLocationScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocationScope" ADD CONSTRAINT "MembershipLocationScope_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocationScope" ADD CONSTRAINT "MembershipLocationScope_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocationScope" ADD CONSTRAINT "MembershipLocationScope_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMerchantProfile" ADD CONSTRAINT "TenantMerchantProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitationLocationScope" ADD CONSTRAINT "TenantInvitationLocationScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitationLocationScope" ADD CONSTRAINT "TenantInvitationLocationScope_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TenantInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitationLocationScope" ADD CONSTRAINT "TenantInvitationLocationScope_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAccessRequest" ADD CONSTRAINT "TenantAccessRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAccessRequest" ADD CONSTRAINT "TenantAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAccessRequest" ADD CONSTRAINT "TenantAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSuspensionAppeal" ADD CONSTRAINT "TenantSuspensionAppeal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSuspensionAppeal" ADD CONSTRAINT "TenantSuspensionAppeal_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSuspensionAppeal" ADD CONSTRAINT "TenantSuspensionAppeal_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_sourceRedemptionId_fkey" FOREIGN KEY ("sourceRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLifecycleEvent" ADD CONSTRAINT "TenantLifecycleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantEncryptionKey" ADD CONSTRAINT "TenantEncryptionKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAuditLog" ADD CONSTRAINT "TenantAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAsset" ADD CONSTRAINT "TenantAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAsset" ADD CONSTRAINT "TenantAsset_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantKybFile" ADD CONSTRAINT "TenantKybFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantKybFile" ADD CONSTRAINT "TenantKybFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVariant" ADD CONSTRAINT "FileVariant_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_tenantId_referrerRewardId_fkey" FOREIGN KEY ("tenantId", "referrerRewardId") REFERENCES "Reward"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_tenantId_parentConsumerRewardId_fkey" FOREIGN KEY ("tenantId", "parentConsumerRewardId") REFERENCES "Reward"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardImage" ADD CONSTRAINT "RewardImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardImage" ADD CONSTRAINT "RewardImage_tenantId_rewardId_fkey" FOREIGN KEY ("tenantId", "rewardId") REFERENCES "Reward"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardImage" ADD CONSTRAINT "RewardImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLocationScope" ADD CONSTRAINT "RewardLocationScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLocationScope" ADD CONSTRAINT "RewardLocationScope_tenantId_rewardId_fkey" FOREIGN KEY ("tenantId", "rewardId") REFERENCES "Reward"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLocationScope" ADD CONSTRAINT "RewardLocationScope_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAudienceMember" ADD CONSTRAINT "RewardAudienceMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAudienceMember" ADD CONSTRAINT "RewardAudienceMember_tenantId_rewardId_fkey" FOREIGN KEY ("tenantId", "rewardId") REFERENCES "Reward"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLegalAcceptance" ADD CONSTRAINT "RewardLegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAuditLog" ADD CONSTRAINT "RewardAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAuditLog" ADD CONSTRAINT "RewardAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "RewardReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaimHold" ADD CONSTRAINT "RewardClaimHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaimHold" ADD CONSTRAINT "RewardClaimHold_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardOtpChallenge" ADD CONSTRAINT "RewardOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardNotification" ADD CONSTRAINT "RewardNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardReferral" ADD CONSTRAINT "RewardReferral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardReferral" ADD CONSTRAINT "RewardReferral_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardReferral" ADD CONSTRAINT "RewardReferral_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupReferralCode" ADD CONSTRAINT "SignupReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupReferral" ADD CONSTRAINT "SignupReferral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupReferral" ADD CONSTRAINT "SignupReferral_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupReferral" ADD CONSTRAINT "SignupReferral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "SignupReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantApiKey" ADD CONSTRAINT "TenantApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantApiKey" ADD CONSTRAINT "TenantApiKey_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantApiKey" ADD CONSTRAINT "TenantApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTerminal" ADD CONSTRAINT "TenantTerminal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTerminal" ADD CONSTRAINT "TenantTerminal_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTerminal" ADD CONSTRAINT "TenantTerminal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTerminal" ADD CONSTRAINT "TenantTerminal_pairingCodeIssuedByUserId_fkey" FOREIGN KEY ("pairingCodeIssuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTerminal" ADD CONSTRAINT "TenantTerminal_tenantId_apiKeyId_fkey" FOREIGN KEY ("tenantId", "apiKeyId") REFERENCES "TenantApiKey"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "RewardClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "RewardSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSale" ADD CONSTRAINT "RewardSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSale" ADD CONSTRAINT "RewardSale_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSale" ADD CONSTRAINT "RewardSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSale" ADD CONSTRAINT "RewardSale_tenantId_apiKeyId_fkey" FOREIGN KEY ("tenantId", "apiKeyId") REFERENCES "TenantApiKey"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SampleCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "KanbanColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_planningColumnId_fkey" FOREIGN KEY ("planningColumnId") REFERENCES "KanbanPlanningColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_executionColumnId_fkey" FOREIGN KEY ("executionColumnId") REFERENCES "KanbanExecutionColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskComment" ADD CONSTRAINT "KanbanTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskComment" ADD CONSTRAINT "KanbanTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskAttachment" ADD CONSTRAINT "KanbanTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskAttachment" ADD CONSTRAINT "KanbanTaskAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "KanbanTaskComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskAttachment" ADD CONSTRAINT "KanbanTaskAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanChecklistItem" ADD CONSTRAINT "KanbanChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanChecklistItem" ADD CONSTRAINT "KanbanChecklistItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskWatcher" ADD CONSTRAINT "KanbanTaskWatcher_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskWatcher" ADD CONSTRAINT "KanbanTaskWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskLink" ADD CONSTRAINT "KanbanTaskLink_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskLink" ADD CONSTRAINT "KanbanTaskLink_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskActivity" ADD CONSTRAINT "KanbanTaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTaskActivity" ADD CONSTRAINT "KanbanTaskActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "EmailLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subregion" ADD CONSTRAINT "Subregion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_subregionId_fkey" FOREIGN KEY ("subregionId") REFERENCES "Subregion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubAccountLink" ADD CONSTRAINT "GithubAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubWebhookSubscription" ADD CONSTRAINT "GithubWebhookSubscription_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsServerSample" ADD CONSTRAINT "OpsServerSample_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "OpsServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadTestPoint" ADD CONSTRAINT "LoadTestPoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoadTestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadTestStepStat" ADD CONSTRAINT "LoadTestStepStat_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoadTestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastReport" ADD CONSTRAINT "BroadcastReport_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagStoreOverride" ADD CONSTRAINT "FeatureFlagStoreOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagStoreOverride" ADD CONSTRAINT "FeatureFlagStoreOverride_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusIncidentUpdate" ADD CONSTRAINT "StatusIncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "StatusIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_tenantId_endpointId_fkey" FOREIGN KEY ("tenantId", "endpointId") REFERENCES "WebhookEndpoint"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_tenantId_eventId_fkey" FOREIGN KEY ("tenantId", "eventId") REFERENCES "WebhookEvent"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
