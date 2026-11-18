import { sql } from "../sql";
import type { TableOfSpecificRule, TableSpecificRule } from "../table-policies";
import type { TableName } from "../table-types";
import { permitted } from "./permission-check";
import { bothWays, systemBypass, type PolicyClauses } from "./policy-clauses";

/**
 * Conditions only one table needs. Each belongs to its table (the generator refuses it anywhere else), and
 * says in its description what it allows. Prefer a reusable rule (policy-rules.ts) whenever one fits.
 *
 * The rule's table is declared once, in `TableSpecificRulePair` (table-policies.ts): `table` below must repeat
 * exactly that table, or this file does not compile.
 */
export interface TableSpecificRuleDefinition<Table extends TableName = TableName> {
	readonly table: Table;
	readonly description: string;
	readonly clauses: PolicyClauses;
}

/** Every one-off rule's definition, on the table its pair names. */
export type TableSpecificRules = { readonly [Rule in TableSpecificRule]: TableSpecificRuleDefinition<TableOfSpecificRule<Rule>> };

const ROLE = systemBypass("Role");
const ROLE_PERMISSION = systemBypass("RolePermission");
const STORED_FILE = systemBypass("StoredFile");
const FILE_VARIANT = systemBypass("FileVariant");
const REWARD = systemBypass("Reward");
const REWARD_LOCATION_SCOPE = systemBypass("RewardLocationScope");
const REWARD_IMAGE = systemBypass("RewardImage");
const REWARD_CLAIM = systemBypass("RewardClaim");
const REWARD_REDEMPTION = systemBypass("RewardRedemption");
const TENANT = systemBypass("Tenant");
const LOCATION = systemBypass("Location");
const TENANT_ACCESS_REQUEST = systemBypass("TenantAccessRequest");

/** The row's own tenant column, as the rules below check it. */
const TENANT_ID = `"tenantId"`;

/** The columns of a stored file a file rule reads: the file's own (`""`), or a joined file's (`"sf."`). */
type FileColumns = "" | "sf.";

/**
 * Who may READ a file (ADR 090): a file with no tenant is its uploader's; a tenant's file follows the permission of
 * the feature that uses it — store branding every member (the merchant shell shows it), verification documents
 * kyb.read (or kyb.update), reward images reward.read (or a reward writer), broadcast images broadcast.read (or an
 * editor). Any other category of a tenant's file is reachable only by system operations.
 */
function fileReadable(file: FileColumns): string {
	const tenant = `${file}"tenantId"`;
	return sql`(
      (${tenant} IS NULL AND app_owns(${file}"uploadedById"))
      OR (${tenant} IS NOT NULL AND (
        (${file}category IN ('STORE_LOGO', 'STORE_BANNER') AND app_tenant_org_member(${tenant}))
        OR (${file}category = 'MERCHANT_KYB' AND (${permitted("KYB", "READ", tenant)} OR ${permitted("KYB", "UPDATE", tenant)}))
        OR (${file}category = 'REWARD_IMAGE' AND (
          ${permitted("REWARD", "READ", tenant)}
          OR ${permitted("REWARD", "CREATE", tenant)}
          OR ${permitted("REWARD", "UPDATE", tenant)}
        ))
        OR (${file}category = 'BROADCAST_IMAGE' AND (${permitted("BROADCAST", "READ", tenant)} OR ${permitted("BROADCAST", "UPDATE", tenant)}))
      ))
    )`;
}

/**
 * Who may WRITE a file (upload, confirm, replace, delete): a file with no tenant is its uploader's; a tenant's file
 * needs the permission that changes the feature using it — location.update (branding), kyb.update, reward.create or
 * reward.update, broadcast.update.
 */
function fileWritable(file: FileColumns): string {
	const tenant = `${file}"tenantId"`;
	return sql`(
      (${tenant} IS NULL AND app_owns(${file}"uploadedById"))
      OR (${tenant} IS NOT NULL AND (
        (${file}category IN ('STORE_LOGO', 'STORE_BANNER') AND ${permitted("LOCATION", "UPDATE", tenant)})
        OR (${file}category = 'MERCHANT_KYB' AND ${permitted("KYB", "UPDATE", tenant)})
        OR (${file}category = 'REWARD_IMAGE' AND (${permitted("REWARD", "CREATE", tenant)} OR ${permitted("REWARD", "UPDATE", tenant)}))
        OR (${file}category = 'BROADCAST_IMAGE' AND ${permitted("BROADCAST", "UPDATE", tenant)})
      ))
    )`;
}

/** A reward writer (role or grant) — they read back what they write (INSERT … RETURNING, UPDATE … WHERE). */
const REWARD_WRITER = sql`${permitted("REWARD", "CREATE", TENANT_ID)}
    OR ${permitted("REWARD", "UPDATE", TENANT_ID)}
    OR ${permitted("REWARD", "PUBLISH", TENANT_ID)}`;

/** An edit or a publish (role or grant), or an EDIT share. */
const REWARD_EDITABLE = sql`${REWARD}
    OR ${permitted("REWARD", "UPDATE", TENANT_ID)}
    OR ${permitted("REWARD", "PUBLISH", TENANT_ID)}
    OR app_shared('REWARD', id, 'EDIT')`;

/** The session user's own membership, confined (like `app_member_of`) to the tenant a tenant route binds. */
const OWN_MEMBERSHIP_IN_BOUND_TENANT = sql`app_owns("userId") AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = "tenantId")`;

/** The API key's own row. */
const API_KEY_SELF = sql`id = app_current_api_key_id() AND app_api_key_org_access("tenantId")`;

export const TABLE_SPECIFIC_RULES: TableSpecificRules = {
	roleCatalogueReadable: {
		table: "Role",
		description: "Platform roles and templates (no tenant) are the catalogue; a tenant's own roles (ADR 067) are visible to its members with role.read.",
		clauses: { command: "SELECT", using: sql`${ROLE} OR "tenantId" IS NULL OR ${permitted("ROLE", "READ", TENANT_ID)}` },
	},
	rolePermissionFollowsRole: {
		table: "RolePermission",
		description: "A role's permissions are visible exactly when the role is (the EXISTS runs under roles_read).",
		clauses: { command: "SELECT", using: sql`${ROLE_PERMISSION} OR EXISTS (SELECT 1 FROM public."Role" r WHERE r.id = "RolePermission"."roleId")` },
	},
	shareReadable: {
		table: "ResourceAcl",
		description:
			"ADR 067: a member sees the shares made to them; seeing everyone's needs member.read. Read only: every write (a delete included) is a system operation, declared as its own policy.",
		clauses: {
			command: "SELECT",
			using: sql`
    "tenantId" IS NULL
    OR EXISTS (SELECT 1 FROM public."Membership" m WHERE m.id = "ResourceAcl"."membershipId" AND app_owns(m."userId"))
    OR ${permitted("MEMBER", "READ", TENANT_ID)}
  `,
		},
	},
	storedFileReadable: {
		table: "StoredFile",
		description:
			"A file without a tenant is its uploader's; a tenant's file is readable with the permission of the feature using it (branding: every member; KYB: kyb.read; reward images: reward.read or a writer; broadcast images: broadcast.read).",
		clauses: { command: "SELECT", using: sql`${STORED_FILE} OR ${fileReadable("")}` },
	},
	storedFileWritable: {
		table: "StoredFile",
		description: "A file is written (uploaded, confirmed, deleted) by its uploader when it has no tenant, otherwise with the permission that changes its feature.",
		clauses: bothWays(sql`${STORED_FILE} OR ${fileWritable("")}`),
	},
	publicRewardImageFile: {
		table: "StoredFile",
		description: "A public reward image is readable by whoever can read its reward (the EXISTS runs under reward_images_read).",
		clauses: {
			command: "SELECT",
			using: sql`
    category = 'REWARD_IMAGE'
    AND visibility = 'PUBLIC'
    AND EXISTS (SELECT 1 FROM public."RewardImage" ri WHERE ri."fileId" = "StoredFile".id AND ri."isDeleted" = false)
  `,
		},
	},
	publicRewardImageVariant: {
		table: "FileVariant",
		description: "A public reward image's renditions are readable whenever the image itself is.",
		clauses: {
			command: "SELECT",
			using: sql`
    EXISTS (
      SELECT 1 FROM public."StoredFile" sf
      WHERE sf.id = "FileVariant"."fileId" AND sf.category = 'REWARD_IMAGE' AND sf.visibility = 'PUBLIC'
    )
  `,
		},
	},
	fileVariantReadable: {
		table: "FileVariant",
		description: "A rendition is readable exactly when its file is (the EXISTS runs under the file's own read policies).",
		clauses: { command: "SELECT", using: sql`${FILE_VARIANT} OR EXISTS (SELECT 1 FROM public."StoredFile" sf WHERE sf.id = "FileVariant"."fileId")` },
	},
	fileVariantWritable: {
		table: "FileVariant",
		description: "A rendition is written exactly when its file may be.",
		clauses: bothWays(sql`
    ${FILE_VARIANT}
    OR EXISTS (SELECT 1 FROM public."StoredFile" sf WHERE sf.id = "FileVariant"."fileId" AND ${fileWritable("sf.")})
  `),
	},
	rewardReadable: {
		table: "Reward",
		description:
			"Published consumer rewards are marketplace-readable; reward.read (role or grant) sees all the tenant's rewards, and so does a reward writer (create, update, publish), who reads back what they write; a share sees that one; a claim holder sees the reward they claimed, whatever its state now.",
		clauses: {
			command: "SELECT",
			using: sql`
    ${REWARD}
    OR ${permitted("REWARD", "READ", TENANT_ID)}
    OR ${REWARD_WRITER}
    OR app_shared('REWARD', id, 'VIEW')
    OR (
      "isDeleted" = false
      AND "rewardKind" = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
    OR app_holds_reward_claim(id)
  `,
		},
	},
	rewardEditable: {
		table: "Reward",
		description: "An edit, or publishing (a lifecycle step that rewrites the row), or an EDIT share. Platform review runs as its own system operation.",
		clauses: {
			command: "UPDATE",
			...bothWays(sql`
    ${REWARD_EDITABLE}
  `),
		},
	},
	rewardScopeReadable: {
		table: "RewardLocationScope",
		description:
			"Members with reward.read (the reward list), a reward writer, a share of the reward, or analytics.read (the store breakdown), and anyone while the reward is a published consumer reward.",
		clauses: {
			command: "SELECT",
			using: sql`
    ${REWARD_LOCATION_SCOPE}
    OR ${permitted("REWARD", "READ", TENANT_ID)}
    OR ${REWARD_WRITER}
    OR app_shared('REWARD', "rewardId", 'VIEW')
    OR ${permitted("ANALYTICS", "READ", TENANT_ID)}
    OR EXISTS (
      SELECT 1 FROM public."Reward" r
      WHERE r.id = "RewardLocationScope"."rewardId"
        AND r."isDeleted" = false
        AND r."rewardKind" = 'CONSUMER'
        AND r.status = 'PUBLISHED'
    )
  `,
		},
	},
	rewardImageReadable: {
		table: "RewardImage",
		description: "Members with reward.read or a reward writer, and whoever can read the image's reward (the EXISTS runs under rewards_read).",
		clauses: {
			command: "SELECT",
			using: sql`
    ${REWARD_IMAGE}
    OR ${permitted("REWARD", "READ", TENANT_ID)}
    OR ${REWARD_WRITER}
    OR EXISTS (SELECT 1 FROM public."Reward" r WHERE r.id = "RewardImage"."rewardId")
  `,
		},
	},
	claimMerchantReadable: {
		table: "RewardClaim",
		description: "A member with claim.read reads the claims of their tenant's rewards (read only); the customer sees only their own (reward_claims_own).",
		clauses: {
			command: "SELECT",
			using: sql`
    ${REWARD_CLAIM}
    OR (EXISTS (
      SELECT 1 FROM public."Reward" r
      WHERE r.id = "RewardClaim"."rewardId"
        AND ${permitted("CLAIM", "READ", `r."tenantId"`)}
    ))
  `,
		},
	},
	redemptionReadable: {
		table: "RewardRedemption",
		description: "The customer, and a member with redemption.read at the redemption's store (a cashier sees only their stores). Written only by the POS checkout.",
		clauses: {
			command: "SELECT",
			using: sql`
    app_owns("userId")
    OR ${permitted("REDEMPTION", "READ", TENANT_ID, `"locationId"`)}
    OR ${REWARD_REDEMPTION}
  `,
		},
	},
	referralParties: {
		table: "RewardReferral",
		description: "The referrer and the referee read a referral. Read only: every write (a delete included) is a system operation, declared as its own policy.",
		clauses: { command: "SELECT", using: sql`app_owns("referrerUserId") OR app_owns("refereeUserId")` },
	},
	outboxAppend: {
		table: "OutboxEvent",
		description:
			"Any session may APPEND a fresh PENDING event in the producer's own transaction (ADR 015) — nothing more: no read (so no INSERT … RETURNING), no change, no pre-published row.",
		clauses: { command: "INSERT", withCheck: sql`status = 'PENDING' AND attempts = 0 AND "publishedAt" IS NULL AND "lastError" IS NULL` },
	},
	webhookEventAppend: {
		table: "WebhookEvent",
		description: "Any session may APPEND an event that is not fanned out yet (ADR 082), like the outbox.",
		clauses: { command: "INSERT", withCheck: sql`"fannedOutAt" IS NULL` },
	},
	tenantVisibleToMembers: {
		table: "Tenant",
		description: "A tenant is visible to its active members.",
		clauses: {
			command: "SELECT",
			using: sql`
    ${TENANT}
    OR app_member_of(id)
    OR (
      app_current_user_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."Membership" m
        WHERE m."tenantId" = "Tenant".id
          AND m."userId" = app_current_user_id()
          AND m.status = 'ACTIVE'
          AND m."isDeleted" = false
      )
    )
  `,
		},
	},
	locationMember: {
		table: "Location",
		description:
			"Every member reads the tenant's stores: the merchant shell's store picker (any role), and every list that names a store (rewards, terminals, analytics) relies on it. Writes need a permission (location_*_write).",
		clauses: {
			command: "SELECT",
			using: sql`
    ${LOCATION}
    OR app_tenant_member_of("tenantId")
    OR app_member_of("tenantId")
  `,
		},
	},
	accessRequestReadable: {
		table: "TenantAccessRequest",
		description: "The person who asked reads their own request; the tenant's reviewers read through the `tenant.access_request.*` system operations.",
		clauses: { command: "SELECT", using: sql`${TENANT_ACCESS_REQUEST} OR "userId" = app_current_user_id()` },
	},
	tenantAuditAppend: {
		table: "TenantAuditLog",
		description:
			"A member of the bound tenant appends an audit row in their own name (the merchant permission check writes one on every request, allowed or denied). Nobody but system operations changes or deletes one.",
		clauses: { command: "INSERT", withCheck: sql`app_tenant_member_of("tenantId") AND "actorUserId" = app_current_user_id()` },
	},
	ownTenantAuditRead: {
		table: "TenantAuditLog",
		description: "A member reads back the audit rows written in their own name (INSERT … RETURNING), in the bound tenant only.",
		clauses: { command: "SELECT", using: sql`app_owns("actorUserId") AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = "tenantId")` },
	},
	ownMembershipRead: {
		table: "Membership",
		description:
			"A member reads their own memberships — only the bound tenant's on a tenant route (DB-008: the Tenant policy finds a user's tenants through this table, so an unbound own-row read would show tenant B on tenant A's route).",
		clauses: { command: "SELECT", using: OWN_MEMBERSHIP_IN_BOUND_TENANT },
	},
	ownMembershipScopes: {
		table: "MembershipLocationScope",
		description: "A member reads the store scope of their own membership (returned when they rename themselves).",
		clauses: {
			command: "SELECT",
			using: sql`EXISTS (SELECT 1 FROM public."Membership" m WHERE m.id = "MembershipLocationScope"."membershipId" AND app_owns(m."userId"))`,
		},
	},
	accessRequestFile: {
		table: "TenantAccessRequest",
		description: "A person files their own access request; reviewing runs as `tenant.access_request.review`.",
		clauses: { command: "INSERT", withCheck: sql`${TENANT_ACCESS_REQUEST} OR "userId" = app_current_user_id()` },
	},
	apiKeySelfRead: {
		table: "TenantApiKey",
		description: "An API key reads its own row (last-used stamp, POS code-guess lockout counters).",
		clauses: { command: "SELECT", using: API_KEY_SELF },
	},
	apiKeySelfUpdate: {
		table: "TenantApiKey",
		description: "An API key updates its own row.",
		clauses: { command: "UPDATE", ...bothWays(API_KEY_SELF) },
	},
	apiKeyReferrerNotice: {
		table: "RewardNotification",
		description: 'Inside a checkout, the in-app "referrer reward credited" notice: only to a user who referred someone to one of this tenant\'s rewards.',
		clauses: {
			command: "INSERT",
			withCheck: sql`
    app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardReferral" rr
      WHERE rr."referrerUserId" = "RewardNotification"."userId"
        AND app_api_key_reward_access(rr."rewardId")
    )
  `,
		},
	},
};
