import type { PolicyRule } from "./table-policies";

/**
 * Every reusable rule with what it allows, for the editor: type `RULE.` in table-policies.ts to browse the rules
 * with their meaning, and hover one to read it (`rule: RULE.ownerOrSystem` is the same as `rule: "ownerOrSystem"`).
 * TypeScript cannot attach documentation to a plain string, which is why this catalogue exists.
 *
 * "System" always means: a named system operation whose registry scope (src/prisma/system-operation.registry.ts)
 * lists the table. The same descriptions, as text, are {@link RULE_DESCRIPTIONS} (`db:security-explain`).
 */
export interface RuleCatalogue {
	/** System operations only: read and write. Needs nothing. */
	readonly system: "system";
	/** System operations only: read. */
	readonly systemRead: "systemRead";
	/** System operations only: insert. */
	readonly systemInsert: "systemInsert";
	/** System operations only: update. */
	readonly systemUpdate: "systemUpdate";
	/** System operations only: delete. */
	readonly systemDelete: "systemDelete";
	/** Only the named system operations, read and write. Needs `operations`. */
	readonly systemOperationWrite: "systemOperationWrite";
	/** The row's owner (`column` is the signed-in user), or system. Needs `column`. */
	readonly ownerOrSystem: "ownerOrSystem";
	/** The same as `ownerOrSystem`, written system-first. Needs `column`. */
	readonly systemOrOwner: "systemOrOwner";
	/** The owner or system: read only. Needs `column`. */
	readonly ownerOrSystemRead: "ownerOrSystemRead";
	/** The owner or system: insert only. Needs `column`. */
	readonly ownerOrSystemInsert: "ownerOrSystemInsert";
	/** The owner or system: update only. Needs `column`. */
	readonly ownerOrSystemUpdate: "ownerOrSystemUpdate";
	/** The owner reads; nothing else. Needs `column`. */
	readonly ownerRead: "ownerRead";
	/** Any active member of the row's tenant, whatever their role, or system. Needs `column`. Refused on tenant tables (ADR 090). */
	readonly tenantMemberOrSystem: "tenantMemberOrSystem";
	/** Any member of the row's tenant reads; system. Needs `column`. */
	readonly tenantMemberReadOrSystem: "tenantMemberReadOrSystem";
	/** The same as `tenantMemberOrSystem`, written system-first. Needs `column`. Refused on tenant tables (ADR 090). */
	readonly systemOrTenantMember: "systemOrTenantMember";
	/** Members of the tenant the session is bound to (a tenant route), or system. Needs `column`. Refused on tenant tables (ADR 090). */
	readonly systemOrActiveTenantMember: "systemOrActiveTenantMember";
	/** Members of the bound tenant read, or system. Needs `column`. */
	readonly systemOrActiveTenantMemberRead: "systemOrActiveTenantMemberRead";
	/** System, or a member of the bound tenant who works at the row's store. Needs `column`, `storeColumn`. Refused on tenant tables (ADR 090). */
	readonly systemOrStoreAccess: "systemOrStoreAccess";
	/** System, or a member; when the row names a store, one who works there. Needs `column`, `storeColumn`. Refused on tenant tables (ADR 090). */
	readonly systemOrOptionalStoreAccess: "systemOrOptionalStoreAccess";
	/** RBAC/ABAC (ADR 067): a role or live grant holding `resource.action` in the row's tenant (at its store when `storeColumn` is given), or system. Read and write. */
	readonly permission: "permission";
	/** The same as `permission`, read only. */
	readonly permissionRead: "permissionRead";
	/** The same as `permission`, insert only. */
	readonly permissionInsert: "permissionInsert";
	/** The same as `permission`, update only. */
	readonly permissionUpdate: "permissionUpdate";
	/** The same as `permission`, delete only. */
	readonly permissionDelete: "permissionDelete";
	/** A merchant API key of the row's tenant reads. Needs `column`. */
	readonly apiKeyRead: "apiKeyRead";
	/** A merchant API key of the row's tenant inserts. Needs `column`. */
	readonly apiKeyInsert: "apiKeyInsert";
	/** A merchant API key of the row's tenant updates. Needs `column`. */
	readonly apiKeyUpdate: "apiKeyUpdate";
	/** An API key of the row's tenant reads, for a row whose tenant may be empty. Needs `column`. */
	readonly apiKeyNullableTenantRead: "apiKeyNullableTenantRead";
	/** An API key of the row's tenant inserts, for a row whose tenant may be empty. Needs `column`. */
	readonly apiKeyNullableTenantInsert: "apiKeyNullableTenantInsert";
	/** An API key of the tenant reads; a store-scoped key only its store's rows. Needs `column`, `storeColumn`. */
	readonly apiKeyStoreRead: "apiKeyStoreRead";
	/** An API key of the tenant inserts; a store-scoped key only at its store. Needs `column`, `storeColumn`. */
	readonly apiKeyStoreInsert: "apiKeyStoreInsert";
	/** An API key of the tenant updates; a store-scoped key only its store's rows. Needs `column`, `storeColumn`. */
	readonly apiKeyStoreUpdate: "apiKeyStoreUpdate";
	/** An API key of the reward's tenant reads (`column` is the reward id). */
	readonly apiKeyRewardRead: "apiKeyRewardRead";
	/** An API key of the reward's tenant inserts (`column` is the reward id). */
	readonly apiKeyRewardInsert: "apiKeyRewardInsert";
	/** An API key of the reward's tenant updates (`column` is the reward id). */
	readonly apiKeyRewardUpdate: "apiKeyRewardUpdate";
	/** An API key that just redeemed for this referee at its store reads. Needs `column`. */
	readonly apiKeySignupRefereeRead: "apiKeySignupRefereeRead";
	/** An API key that just redeemed for this referee at its store updates. Needs `column`. */
	readonly apiKeySignupRefereeUpdate: "apiKeySignupRefereeUpdate";
	/** An API key of a tenant this user is a customer of reads. Needs `column`. */
	readonly apiKeyCustomerRead: "apiKeyCustomerRead";
	/** Anyone reads (reference data). */
	readonly readableByAll: "readableByAll";
	/** Anyone appends (a request row that commits with the caller's own change). */
	readonly anyoneInsert: "anyoneInsert";
	/** Only a trigger inserts. */
	readonly triggerInsert: "triggerInsert";
	/** Only a trigger updates. */
	readonly triggerUpdate: "triggerUpdate";
	/** Only a trigger, or system, reads. */
	readonly triggerOrSystemRead: "triggerOrSystemRead";
	/** Only the dedicated role `to` reads (optionally only rows matching `where`). */
	readonly roleRead: "roleRead";
	/** Only the dedicated role `to` inserts (optionally only rows matching `where`). */
	readonly roleInsert: "roleInsert";
	/** Only the dedicated role `to` updates (optionally only rows matching `where`). */
	readonly roleUpdate: "roleUpdate";
	/** Only the dedicated role `to` deletes (optionally only rows matching `where`). */
	readonly roleDelete: "roleDelete";
	/** Only the dedicated role `to`: read and write (optionally only rows matching `where`). */
	readonly roleAll: "roleAll";
}

export const RULE: RuleCatalogue = {
	system: "system",
	systemRead: "systemRead",
	systemInsert: "systemInsert",
	systemUpdate: "systemUpdate",
	systemDelete: "systemDelete",
	systemOperationWrite: "systemOperationWrite",
	ownerOrSystem: "ownerOrSystem",
	systemOrOwner: "systemOrOwner",
	ownerOrSystemRead: "ownerOrSystemRead",
	ownerOrSystemInsert: "ownerOrSystemInsert",
	ownerOrSystemUpdate: "ownerOrSystemUpdate",
	ownerRead: "ownerRead",
	tenantMemberOrSystem: "tenantMemberOrSystem",
	tenantMemberReadOrSystem: "tenantMemberReadOrSystem",
	systemOrTenantMember: "systemOrTenantMember",
	systemOrActiveTenantMember: "systemOrActiveTenantMember",
	systemOrActiveTenantMemberRead: "systemOrActiveTenantMemberRead",
	systemOrStoreAccess: "systemOrStoreAccess",
	systemOrOptionalStoreAccess: "systemOrOptionalStoreAccess",
	permission: "permission",
	permissionRead: "permissionRead",
	permissionInsert: "permissionInsert",
	permissionUpdate: "permissionUpdate",
	permissionDelete: "permissionDelete",
	apiKeyRead: "apiKeyRead",
	apiKeyInsert: "apiKeyInsert",
	apiKeyUpdate: "apiKeyUpdate",
	apiKeyNullableTenantRead: "apiKeyNullableTenantRead",
	apiKeyNullableTenantInsert: "apiKeyNullableTenantInsert",
	apiKeyStoreRead: "apiKeyStoreRead",
	apiKeyStoreInsert: "apiKeyStoreInsert",
	apiKeyStoreUpdate: "apiKeyStoreUpdate",
	apiKeyRewardRead: "apiKeyRewardRead",
	apiKeyRewardInsert: "apiKeyRewardInsert",
	apiKeyRewardUpdate: "apiKeyRewardUpdate",
	apiKeySignupRefereeRead: "apiKeySignupRefereeRead",
	apiKeySignupRefereeUpdate: "apiKeySignupRefereeUpdate",
	apiKeyCustomerRead: "apiKeyCustomerRead",
	readableByAll: "readableByAll",
	anyoneInsert: "anyoneInsert",
	triggerInsert: "triggerInsert",
	triggerUpdate: "triggerUpdate",
	triggerOrSystemRead: "triggerOrSystemRead",
	roleRead: "roleRead",
	roleInsert: "roleInsert",
	roleUpdate: "roleUpdate",
	roleDelete: "roleDelete",
	roleAll: "roleAll",
};

/** What each reusable rule allows, in plain words (`db:security-explain`, and the docs' rule table). */
export const RULE_DESCRIPTIONS: Readonly<Record<PolicyRule, string>> = {
	system: "system operations only (read and write)",
	systemRead: "system operations only (read)",
	systemInsert: "system operations only (insert)",
	systemUpdate: "system operations only (update)",
	systemDelete: "system operations only (delete)",
	systemOperationWrite: "only the named system operations (read and write)",
	ownerOrSystem: "the row's owner, or system (read and write)",
	systemOrOwner: "the row's owner, or system (read and write)",
	ownerOrSystemRead: "the row's owner, or system (read)",
	ownerOrSystemInsert: "the row's owner, or system (insert)",
	ownerOrSystemUpdate: "the row's owner, or system (update)",
	ownerRead: "the row's owner (read)",
	tenantMemberOrSystem: "any member of the row's tenant, or system (read and write)",
	tenantMemberReadOrSystem: "any member of the row's tenant, or system (read)",
	systemOrTenantMember: "any member of the row's tenant, or system (read and write)",
	systemOrActiveTenantMember: "members of the bound tenant, or system (read and write)",
	systemOrActiveTenantMemberRead: "members of the bound tenant, or system (read)",
	systemOrStoreAccess: "members working at the row's store, or system (read and write)",
	systemOrOptionalStoreAccess: "members (at the row's store when it names one), or system (read and write)",
	permission: "holders of the permission (role or grant), or system (read and write)",
	permissionRead: "holders of the permission (role or grant), or system (read)",
	permissionInsert: "holders of the permission (role or grant), or system (insert)",
	permissionUpdate: "holders of the permission (role or grant), or system (update)",
	permissionDelete: "holders of the permission (role or grant), or system (delete)",
	apiKeyRead: "a merchant API key of the row's tenant (read)",
	apiKeyInsert: "a merchant API key of the row's tenant (insert)",
	apiKeyUpdate: "a merchant API key of the row's tenant (update)",
	apiKeyNullableTenantRead: "a merchant API key of the row's tenant, when it has one (read)",
	apiKeyNullableTenantInsert: "a merchant API key of the row's tenant, when it has one (insert)",
	apiKeyStoreRead: "a merchant API key of the tenant, at the row's store when store-scoped (read)",
	apiKeyStoreInsert: "a merchant API key of the tenant, at the row's store when store-scoped (insert)",
	apiKeyStoreUpdate: "a merchant API key of the tenant, at the row's store when store-scoped (update)",
	apiKeyRewardRead: "a merchant API key of the reward's tenant (read)",
	apiKeyRewardInsert: "a merchant API key of the reward's tenant (insert)",
	apiKeyRewardUpdate: "a merchant API key of the reward's tenant (update)",
	apiKeySignupRefereeRead: "the API key that just redeemed for this referee (read)",
	apiKeySignupRefereeUpdate: "the API key that just redeemed for this referee (update)",
	apiKeyCustomerRead: "a merchant API key of a tenant this user is a customer of (read)",
	readableByAll: "anyone (read)",
	anyoneInsert: "anyone (insert)",
	triggerInsert: "only a trigger (insert)",
	triggerUpdate: "only a trigger (update)",
	triggerOrSystemRead: "only a trigger, or system (read)",
	roleRead: "only the dedicated role (read)",
	roleInsert: "only the dedicated role (insert)",
	roleUpdate: "only the dedicated role (update)",
	roleDelete: "only the dedicated role (delete)",
	roleAll: "only the dedicated role (read and write)",
};
