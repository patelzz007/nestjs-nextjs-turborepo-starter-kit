/**
 * RLS manifest index — single source for drift checks and contributor docs.
 * Every Prisma `@@map` table should appear in exactly one profile below.
 */

export type RlsManifestProfile =
	| "ownership"
	| "rbac_catalog"
	| "organization_tenant"
	| "organization_location"
	| "bypass_only"
	| "geo_reference"
	| "user_identity"
	| "url_analytics"
	| "file_derived"
	| "product_catalog"
	| "reward_user"
	| "authorization_simulation";

export const RLS_MANIFEST_PROFILES: Readonly<Record<RlsManifestProfile, readonly string[]>> = {
	ownership: [
		"urls",
		"tags",
		"api_keys",
		"refresh_tokens",
		"password_reset_tokens",
		"password_history",
		"backup_codes",
		"two_factor_pending_setups",
		"two_factor_login_challenges",
		"mfa_recovery_requests",
		"user_avatars",
	],
	rbac_catalog: ["roles", "permissions", "capability_definitions", "role_permissions", "user_roles", "user_permissions"],
	organization_tenant: [
		"organizations",
		"organization_slug_history",
		"organization_locations",
		"organization_memberships",
		"organization_membership_location_scopes",
		"organization_merchant_profiles",
		"organization_invitations",
		"organization_invitation_location_scopes",
		"organization_access_requests",
		"organization_audit_logs",
		"organization_lifecycle_events",
		"tenant_placements",
		"organization_entitlements",
		"organization_quotas",
		"authorization_policy_drafts",
		"authorization_policy_versions",
		"support_access_grants",
		"tenant_encryption_keys",
		"stored_files",
		"organization_assets",
		"organization_kyb_documents",
		"organization_kyb_files",
		"rewards",
		"reward_location_scopes",
		"reward_audit_logs",
	],
	organization_location: ["organization_terminals", "organization_api_keys"],
	bypass_only: [
		"outbox_events",
		"analytics_events",
		"platform_resource_audit_logs",
		"platform_resource_idempotency_records",
		"permission_audit_logs",
		"reward_redemption_idempotency_records",
		"product_images",
	],
	geo_reference: ["regions", "subregions", "countries", "states", "cities"],
	user_identity: ["users"],
	url_analytics: ["url_tags", "clicks", "logs", "email_logs", "impersonation_audit_logs", "api_key_usage_logs"],
	file_derived: ["file_variants"],
	product_catalog: ["product", "sample_category"],
	reward_user: [
		"reward_claims",
		"reward_redemptions",
		"reward_referrals",
		"reward_otp_challenges",
		"reward_legal_acceptances",
		"reward_notifications",
	],
	authorization_simulation: ["authorization_policy_simulations"],
};

/** @deprecated Use `RLS_MANIFEST_PROFILES.ownership` — kept for existing imports. */
export const RLS_OWNERSHIP_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.ownership;

/** @deprecated Use `RLS_MANIFEST_PROFILES.rbac_catalog`. */
export const RLS_RBAC_CATALOG_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.rbac_catalog;

/** @deprecated Use `RLS_MANIFEST_PROFILES.organization_tenant`. */
export const RLS_ORGANIZATION_TENANT_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.organization_tenant;

/** @deprecated Use `RLS_MANIFEST_PROFILES.organization_location`. */
export const RLS_ORGANIZATION_LOCATION_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.organization_location;

/** @deprecated Use `RLS_MANIFEST_PROFILES.bypass_only`. */
export const RLS_BYPASS_ONLY_TABLES: readonly string[] = RLS_MANIFEST_PROFILES.bypass_only;

export interface PrismaTableModel {
	readonly tableName: string;
	readonly hasOrganizationId: boolean;
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

export function buildManifestTableToProfileMap(): Map<string, RlsManifestProfile> {
	const map = new Map<string, RlsManifestProfile>();
	for (const [profile, tables] of Object.entries(RLS_MANIFEST_PROFILES) as [RlsManifestProfile, readonly string[]][]) {
		for (const table of tables) {
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

		const mapMatch = /@@map\("([^"]+)"\)/.exec(body);
		const tableName = mapMatch?.[1];
		if (tableName === undefined) {
			continue;
		}

		const hasOrganizationId = /\n\s*organizationId\s+String/.test(body);
		const hasRequiredLocationId = /\n\s*locationId\s+String\s+@map\("location_id"\)/.test(body);
		const hasOptionalLocationId =
			/\n\s*locationId\s+String\?\s+@map\("location_id"\)/.test(body) ||
			(/\n\s*locationId\s+String\?/.test(body) && body.includes('@map("location_id")'));

		models.push({
			tableName,
			hasOrganizationId,
			hasRequiredLocationId,
			hasOptionalLocationId,
		});
	}

	return models;
}

export function collectRlsEnabledTableNames(rlsSqlContent: string): Set<string> {
	const tables = new Set<string>();

	const arrayPattern = /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([\s\S]*?)\]/g;
	for (const match of rlsSqlContent.matchAll(arrayPattern)) {
		const inner = match[1];
		const quoted = inner.match(/'([^']+)'/g);
		if (quoted !== null) {
			for (const item of quoted) {
				tables.add(item.slice(1, -1));
			}
		}
	}

	const alterPattern = /ALTER TABLE(?: IF EXISTS)? public\.(\w+) ENABLE ROW LEVEL SECURITY/g;
	for (const match of rlsSqlContent.matchAll(alterPattern)) {
		tables.add(match[1]);
	}

	const alterUnqualified = /ALTER TABLE (\w+) ENABLE ROW LEVEL SECURITY/g;
	for (const match of rlsSqlContent.matchAll(alterUnqualified)) {
		tables.add(match[1]);
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
		if (model.hasOrganizationId && !manifestSet.has(model.tableName)) {
			orgModelsMissingManifest.push(model.tableName);
		}
		const profile = profileMap.get(model.tableName);
		const locationScopeJunctionTables: readonly string[] = [
			"reward_location_scopes",
			"organization_invitation_location_scopes",
			"organization_membership_location_scopes",
		];
		if (
			model.hasRequiredLocationId &&
			profile !== "organization_location" &&
			profile !== "organization_tenant" &&
			!locationScopeJunctionTables.includes(model.tableName)
		) {
			locationProfileMismatch.push(`${model.tableName} (expected organization_location or organization_tenant profile)`);
		}
		if (profile === "organization_location" && !model.hasRequiredLocationId && !model.hasOptionalLocationId) {
			locationProfileMismatch.push(`${model.tableName} (manifest organization_location but schema has no location_id)`);
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
