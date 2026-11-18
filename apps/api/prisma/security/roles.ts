/**
 * Every PostgreSQL role the application uses, and exactly what each may touch — the source of
 * `prisma/rls/01-roles.sql` (the roles) and `prisma/rls/05-grants.sql` (their privileges).
 *
 * Every role is NOLOGIN and NOBYPASSRLS: a process reaches it through `SET ROLE` from its own login, and
 * row-level security always applies. To add a role, add it to `DatabaseRoleNameSchema` and `DATABASE_ROLES`
 * (the `Record` type makes a missing entry a compile error), then `pnpm db:generate-security`.
 *
 * Table privileges `app_runtime` must NOT hold (append-only and never-deleted tables) are declared in
 * withheld-privileges.ts: they are revoked after the blanket grant below, in the same transaction.
 */
import { z } from "zod";

import type { FunctionSignature } from "./generator/security-function";
import type { ColumnOf, TableName } from "./table-types";

export const DatabaseRoleNameSchema = z.enum(["app_runtime", "app_enumerator", "app_retention", "app_erasure", "analytics_consumer", "app_backup"]);
export type DatabaseRoleName = z.output<typeof DatabaseRoleNameSchema>;

/** A table privilege a role may be granted. */
export type TablePrivilege = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
/** A sequence privilege a role may be granted. */
export type SequencePrivilege = "USAGE" | "SELECT";
/** What `REVOKE ALL ON ALL … IN SCHEMA public` resets before the grants, so a removed grant is removed everywhere. */
export type ResetScope = "tables" | "sequences";

/** Privileges on whole named tables. */
export interface WholeTableGrant {
	readonly tables: readonly TableName[];
	readonly privileges: readonly TablePrivilege[];
	readonly columns?: undefined;
}

/** Privileges on some columns of one table (a column-level grant): only that table's columns are accepted. */
export type ColumnGrant = {
	readonly [Table in TableName]: {
		readonly tables: readonly [Table];
		readonly privileges: readonly TablePrivilege[];
		readonly columns: readonly ColumnOf<Table>[];
	};
}[TableName];

/** Privileges on named tables, optionally only on some columns of one. */
export type TableGrant = WholeTableGrant | ColumnGrant;

/** One role: how it is created, and everything it is granted. */
export interface DatabaseRole {
	/** Why the role exists, in one line (a comment in the generated SQL). */
	readonly purpose: string;
	/** CREATE ROLE attributes (only on creation: an existing role is left as it is). */
	readonly attributes: string;
	/** The applying login is made a member, so it may `SET ROLE` to it (the API, the seed, the consumer replay). */
	readonly memberOfApplyingLogin: boolean;
	/** Privileges revoked first, so a grant removed from this file is removed from existing databases too. */
	readonly resetFirst: readonly ResetScope[];
	/** USAGE on the `public` schema. */
	readonly schemaUsage: boolean;
	/** Privileges on every table and sequence (`ON ALL … IN SCHEMA public`), and the defaults for new ones. */
	readonly allTables?: readonly TablePrivilege[];
	readonly allSequences?: readonly SequencePrivilege[];
	readonly defaultTables?: readonly TablePrivilege[];
	readonly defaultSequences?: readonly SequencePrivilege[];
	/** Privileges on named tables, in order. */
	readonly tableGrants?: readonly TableGrant[];
	/** Functions it may EXECUTE, by signature (`name(argument types)`). */
	readonly executes?: readonly FunctionSignature[];
}

/** Attributes of a role reached only through SET ROLE from the application's own login. */
const SET_ROLE_ONLY = "NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS";
/** Attributes of a group role a dedicated LOGIN is made a member of. */
const GROUP_ROLE = "NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS";
const ALL_TABLE_PRIVILEGES: readonly TablePrivilege[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const USE_SEQUENCES: readonly SequencePrivilege[] = ["USAGE", "SELECT"];

/** Every helper function a policy calls: any role that reads a protected table runs them. */
const POLICY_HELPERS: readonly FunctionSignature[] = [
	"app_rls_bypass()",
	"app_rls_bypass_on(text)",
	"app_current_user_id()",
	"app_current_tenant_id()",
	"app_owns(text)",
	"app_member_of(text)",
	"app_tenant_member_of(text)",
	"app_tenant_org_member(text)",
	"app_tenant_has_location_access(text)",
	"app_tenant_row_org_location_access(text, text)",
	"app_tenant_org_optional_location_access(text, text)",
	"app_has_permission(text, text, text, text)",
	"app_permitted_tenants(text, text)",
	"app_permitted_stores(text, text)",
	"app_shared(text, text, text)",
	"app_holds_reward_claim(text)",
	"app_current_api_key_id()",
	"app_current_api_key_location_id()",
	"app_api_key_org_access(text)",
	"app_api_key_store_access(text, text)",
	"app_api_key_reward_access(text)",
	"app_api_key_signup_referee_access(text)",
	"app_api_key_customer_access(text)",
	"app_system_operation()",
];

export const DATABASE_ROLES: Readonly<Record<DatabaseRoleName, DatabaseRole>> = {
	app_runtime: {
		purpose: "The application role (API, workers, seed): DML on every table, filtered by RLS policies. Reached only via SET ROLE.",
		attributes: SET_ROLE_ONLY,
		memberOfApplyingLogin: true,
		resetFirst: [],
		schemaUsage: true,
		allTables: ALL_TABLE_PRIVILEGES,
		allSequences: USE_SEQUENCES,
		defaultTables: ALL_TABLE_PRIVILEGES,
		defaultSequences: USE_SEQUENCES,
		executes: [
			...POLICY_HELPERS,
			"public.app_purge_audit_batch(text, bigint, integer, boolean)",
			"public.app_mask_erased_person(text, text)",
			"public.app_mask_personal_json(jsonb, text)",
		],
	},
	app_enumerator: {
		purpose:
			"The `tenant.enumerate` system operation's role: SELECT on Tenant (and the Membership table its policy reads), nothing else — a scheduler fan-out lists tenant ids but never reads tenant data.",
		attributes: SET_ROLE_ONLY,
		memberOfApplyingLogin: true,
		resetFirst: ["tables", "sequences"],
		schemaUsage: true,
		tableGrants: [
			{ tables: ["Tenant"], privileges: ["SELECT"] },
			{ tables: ["Membership"], privileges: ["SELECT"] },
		],
		executes: ["app_rls_bypass()", "app_rls_bypass_on(text)", "app_system_operation()", "app_current_user_id()", "app_member_of(text)"],
	},
	app_retention: {
		purpose: "Owns public.app_purge_audit_batch (ADR 078): the only holder of DELETE on the audit tables, through policies that name it alone.",
		attributes: GROUP_ROLE,
		memberOfApplyingLogin: false,
		resetFirst: ["tables"],
		schemaUsage: true,
		tableGrants: [
			{ tables: ["AuditLog", "DataChangeLog", "DataChangeGroup"], privileges: ["SELECT", "DELETE"] },
			{ tables: ["AuditLegalHold"], privileges: ["SELECT"] },
		],
	},
	app_erasure: {
		purpose: "Owns public.app_mask_erased_person (ADR 077): reads and masks the person in kept records, through policies that name it alone.",
		attributes: GROUP_ROLE,
		memberOfApplyingLogin: false,
		resetFirst: ["tables"],
		schemaUsage: true,
		tableGrants: [
			{ tables: ["AccountErasure"], privileges: ["SELECT"] },
			{
				tables: [
					"AuditLog",
					"DataChangeLog",
					"MarketingConsent",
					"ImpersonationAuditLog",
					"ImpersonationSession",
					"MfaRecoveryAuditLog",
					"AuthorizationAudit",
					"EmailLog",
					"Notification",
				],
				privileges: ["SELECT", "UPDATE"],
			},
		],
		executes: ["public.app_mask_personal_json(jsonb, text)"],
	},
	analytics_consumer: {
		purpose:
			"apps/analytics-consumer's group role (its LOGIN: ANALYTICS_CONSUMER_DATABASE_URL): exactly what the ingest and retention paths need, rows limited to its own consumer id.",
		attributes: GROUP_ROLE,
		memberOfApplyingLogin: true,
		resetFirst: ["tables", "sequences"],
		schemaUsage: true,
		tableGrants: [
			{ tables: ["InboxProcessedEvent"], privileges: ["SELECT", "INSERT", "DELETE"] },
			{ tables: ["AnalyticsEvent"], privileges: ["INSERT"] },
			// INSERT … ON CONFLICT (id) reads its arbiter column.
			{ tables: ["AnalyticsEvent"], privileges: ["SELECT"], columns: ["id"] },
			{ tables: ["InboxDeadLetter"], privileges: ["SELECT", "INSERT", "DELETE"] },
			// Feature flags v2 (ADR 087): exposures, their daily sums, experiment metrics and results.
			{ tables: ["FeatureFlagExposure"], privileges: ["SELECT", "INSERT", "DELETE"] },
			{ tables: ["FeatureFlagExposureDaily"], privileges: ["SELECT", "INSERT", "DELETE"] },
			{ tables: ["ExperimentMetricEvent"], privileges: ["SELECT", "INSERT", "DELETE"] },
			{ tables: ["Experiment"], privileges: ["SELECT"] },
			{ tables: ["ExperimentResult"], privileges: ["SELECT", "INSERT", "UPDATE"] },
		],
	},
	app_backup: {
		purpose:
			"The backup's read-only group role (ADR 068): SELECT on everything, never DML or DDL. Its LOGIN (BACKUP_DATABASE_URL) carries BYPASSRLS itself (pnpm db:provision-backup-login).",
		attributes: GROUP_ROLE,
		memberOfApplyingLogin: false,
		resetFirst: ["tables", "sequences"],
		schemaUsage: true,
		allTables: ["SELECT"],
		allSequences: ["SELECT"],
		defaultTables: ["SELECT"],
		defaultSequences: ["SELECT"],
	},
};
