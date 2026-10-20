/**
 * RLS manifest index — single source for drift checks and contributor docs.
 * Every Prisma model (its table is named exactly like the model) appears in exactly one profile below.
 */

export type RlsManifestProfile =
	| "ownership"
	| "rbac_catalog"
	| "tenant"
	| "location"
	| "bypass_only"
	| "geo_reference"
	| "user_identity"
	| "append_log"
	| "file_derived"
	| "product_catalog"
	| "reward_user"
	| "authorization_simulation";

export const RLS_MANIFEST_PROFILES: Readonly<Record<RlsManifestProfile, readonly string[]>> = {
	ownership: [
		"RefreshToken",
		"PasswordResetToken",
		"PasswordHistory",
		"BackupCode",
		"TwoFactorPendingSetup",
		"TwoFactorLoginChallenge",
		"MfaRecoveryRequest",
		"UserAvatar",
		"GithubAccountLink",
	],
	rbac_catalog: ["Role", "Permission", "CapabilityDefinition", "RolePermission", "UserRole", "UserPermission", "PolicyDefinition"],
	tenant: [
		"Tenant",
		"TenantSlugHistory",
		"Location",
		"Store",
		"StoreMembership",
		"Membership",
		"MembershipLocationScope",
		"TenantMerchantProfile",
		"TenantInvitation",
		"TenantInvitationLocationScope",
		"TenantAccessRequest",
		"TenantAuditLog",
		"TenantLifecycleEvent",
		"TenantPlacement",
		"AuthorizationPolicyDraft",
		"AuthorizationPolicyVersion",
		"SupportAccessGrant",
		"TenantEncryptionKey",
		"StoredFile",
		"TenantAsset",
		"TenantKybFile",
		"Reward",
		"RewardLocationScope",
		"RewardImage",
		"RewardAuditLog",
		"ResourceAcl",
	],
	location: ["TenantTerminal", "TenantApiKey"],
	bypass_only: [
		"EmailDeliveryEvent",
		"OutboxEvent",
		"AnalyticsEvent",
		"InboxProcessedEvent",
		"InboxDeadLetter",
		"AuditLog",
		"DataChangeLog",
		"PlatformResourceIdempotencyRecord",
		"PermissionAuditLog",
		"AuthorizationAudit",
		"ImpersonationSession",
		"MfaRecoveryAuditLog",
		"ProductImage",
		"GithubWebhookSubscription",
		"GithubWebhookDelivery",
	],
	geo_reference: ["Region", "Subregion", "Country", "State", "City"],
	user_identity: ["User"],
	append_log: ["EmailLog", "ImpersonationAuditLog"],
	file_derived: ["FileVariant"],
	product_catalog: ["Product", "SampleCategory"],
	reward_user: [
		"RewardClaim",
		"RewardRedemption",
		"RewardSale",
		"RewardReferral",
		"SignupReferralCode",
		"SignupReferral",
		"RewardOtpChallenge",
		"RewardLegalAcceptance",
		"RewardNotification",
	],
	authorization_simulation: ["AuthorizationPolicySimulation"],
};

/** @deprecated Use `RLS_MANIFEST_PROFILES.ownership` — kept for existing imports. */
export const RLS_OWNERSHIP_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.ownership;

/** @deprecated Use `RLS_MANIFEST_PROFILES.rbac_catalog`. */
export const RLS_RBAC_CATALOG_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.rbac_catalog;

/** @deprecated Use `RLS_MANIFEST_PROFILES.tenant`. */
export const RLS_TENANT_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.tenant;

/** @deprecated Use `RLS_MANIFEST_PROFILES.location`. */
export const RLS_LOCATION_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.location;

/** @deprecated Use `RLS_MANIFEST_PROFILES.bypass_only`. */
export const RLS_BYPASS_ONLY_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.bypass_only;

export interface PrismaTableModel {
	readonly tableName: string;
	readonly hasTenantId: boolean;
	readonly hasRequiredLocationId: boolean;
	readonly hasOptionalLocationId: boolean;
}

export interface RlsManifestDriftReport {
	readonly missingFromManifest: readonly string[];
	readonly unknownManifestTables: readonly string[];
	readonly orgModelsMissingManifest: readonly string[];
	readonly locationProfileMismatch: readonly string[];
	readonly manifestNotInRlsSql: readonly string[];
}

export function listAllManifestTables(): string[] {
	const tables: string[] = [];
	for (const profile of Object.values(RLS_MANIFEST_PROFILES)) {
		tables.push(...profile);
	}
	return tables;
}

function isRlsManifestProfile(key: string): key is RlsManifestProfile {
	return Object.hasOwn(RLS_MANIFEST_PROFILES, key);
}

export function buildManifestTableToProfileMap(): Map<string, RlsManifestProfile> {
	const map = new Map<string, RlsManifestProfile>();
	for (const profile of Object.keys(RLS_MANIFEST_PROFILES)) {
		if (!isRlsManifestProfile(profile)) {
			continue;
		}
		for (const table of RLS_MANIFEST_PROFILES[profile]) {
			map.set(table, profile);
		}
	}
	return map;
}

export function parsePrismaSchemaModels(schemaContent: string): PrismaTableModel[] {
	const models: PrismaTableModel[] = [];
	const modelBlocks = schemaContent.split(/\nmodel\s+/).slice(1);

	for (const block of modelBlocks) {
		const nameMatch = /^(\w+)\s*\{/.exec(block);
		if (nameMatch === null) {
			continue;
		}

		const bodyEnd = block.indexOf("\n}");
		const body = bodyEnd === -1 ? block : block.slice(0, bodyEnd);

		// Tables are named exactly like their models (no @@map — prisma/schema.prisma).
		const [, tableName] = nameMatch;
		if (tableName === undefined) {
			continue;
		}

		const hasTenantId = /\n\s*tenantId\s+String/.test(body);
		const hasRequiredLocationId = /\n\s*locationId\s+String(?!\?)\b/.test(body);
		const hasOptionalLocationId = /\n\s*locationId\s+String\?/.test(body);

		models.push({
			tableName,
			hasTenantId,
			hasRequiredLocationId,
			hasOptionalLocationId,
		});
	}

	return models;
}

export function collectRlsEnabledTableNames(rlsSqlContent: string): Set<string> {
	const tables = new Set<string>();

	const arrayPattern = /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[(?<inner>[\s\S]*?)\]/g;
	for (const match of rlsSqlContent.matchAll(arrayPattern)) {
		const inner = match.groups?.inner;
		if (inner === undefined) {
			continue;
		}
		const quoted = inner.match(/'([^']+)'/g);
		if (quoted !== null) {
			for (const item of quoted) {
				tables.add(item.slice(1, -1));
			}
		}
	}

	const alterPattern = /ALTER TABLE(?: IF EXISTS)? public\."?(?<tableName>\w+)"? ENABLE ROW LEVEL SECURITY/g;
	for (const match of rlsSqlContent.matchAll(alterPattern)) {
		const tableName = match.groups?.tableName;
		if (tableName !== undefined) {
			tables.add(tableName);
		}
	}

	const alterUnqualified = /ALTER TABLE "?(?<tableName>\w+)"? ENABLE ROW LEVEL SECURITY/g;
	for (const match of rlsSqlContent.matchAll(alterUnqualified)) {
		const tableName = match.groups?.tableName;
		if (tableName !== undefined) {
			tables.add(tableName);
		}
	}

	return tables;
}

export function computeRlsManifestDrift(input: {
	readonly prismaModels: readonly PrismaTableModel[];
	readonly manifestTables: readonly string[];
	readonly rlsEnabledTables: ReadonlySet<string>;
}): RlsManifestDriftReport {
	const manifestSet = new Set(input.manifestTables);
	const prismaTableSet = new Set(input.prismaModels.map((m) => m.tableName));
	const profileMap = buildManifestTableToProfileMap();

	const missingFromManifest: string[] = [];
	const orgModelsMissingManifest: string[] = [];
	const locationProfileMismatch: string[] = [];

	for (const model of input.prismaModels) {
		if (!manifestSet.has(model.tableName)) {
			missingFromManifest.push(model.tableName);
		}
		if (model.hasTenantId && !manifestSet.has(model.tableName)) {
			orgModelsMissingManifest.push(model.tableName);
		}
		const profile = profileMap.get(model.tableName);
		const locationScopeJunctionTables: readonly string[] = ["RewardLocationScope", "TenantInvitationLocationScope", "MembershipLocationScope"];
		if (model.hasRequiredLocationId && profile !== "location" && profile !== "tenant" && !locationScopeJunctionTables.includes(model.tableName)) {
			locationProfileMismatch.push(`${model.tableName} (expected location or tenant profile)`);
		}
		if (profile === "location" && !model.hasRequiredLocationId && !model.hasOptionalLocationId) {
			locationProfileMismatch.push(`${model.tableName} (manifest location but schema has no "locationId")`);
		}
	}

	const unknownManifestTables: string[] = [];
	for (const table of manifestSet) {
		if (!prismaTableSet.has(table)) {
			unknownManifestTables.push(table);
		}
	}

	const manifestNotInRlsSql: string[] = [];
	for (const table of manifestSet) {
		if (!input.rlsEnabledTables.has(table)) {
			manifestNotInRlsSql.push(table);
		}
	}

	const sort = (items: string[]): string[] => [...items].sort((a, b) => a.localeCompare(b));

	return {
		missingFromManifest: sort(missingFromManifest),
		unknownManifestTables: sort(unknownManifestTables),
		orgModelsMissingManifest: sort(orgModelsMissingManifest),
		locationProfileMismatch: sort(locationProfileMismatch),
		manifestNotInRlsSql: sort(manifestNotInRlsSql),
	};
}
