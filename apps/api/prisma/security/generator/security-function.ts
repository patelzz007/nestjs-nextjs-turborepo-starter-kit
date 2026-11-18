import type { DatabaseRoleName } from "../roles";

/**
 * Every function the security SQL defines, by signature (`name(argument types)`): what `roles.ts` grants EXECUTE
 * on, autocompleted and type-checked. A new function adds its signature here and to {@link FUNCTION_SIGNATURES}.
 */
export type FunctionSignature =
	| "app_system_operation()"
	| "app_rls_bypass()"
	| "app_current_user_id()"
	| "app_current_tenant_id()"
	| "app_owns(text)"
	| "app_rls_bypass_on(text)"
	| "app_member_of(text)"
	| "app_tenant_member_of(text)"
	| "app_tenant_org_member(text)"
	| "app_tenant_has_location_access(text)"
	| "app_tenant_row_org_location_access(text, text)"
	| "app_tenant_org_optional_location_access(text, text)"
	| "app_has_permission(text, text, text, text)"
	| "app_permitted_tenants(text, text)"
	| "app_permitted_stores(text, text)"
	| "app_shared(text, text, text)"
	| "app_holds_reward_claim(text)"
	| "app_current_api_key_id()"
	| "app_current_api_key_location_id()"
	| "app_api_key_org_access(text)"
	| "app_api_key_store_access(text, text)"
	| "app_api_key_reward_access(text)"
	| "app_api_key_signup_referee_access(text)"
	| "app_api_key_customer_access(text)"
	| "app_stamp_authorization_change()"
	| "audit_trail_notify()"
	| "public.app_purge_audit_batch(text, bigint, integer, boolean)"
	| "public.app_mask_personal_json(jsonb, text)"
	| "public.app_mask_erased_person(text, text)";

/** Every signature, once (a `Record`, so a signature missing here does not compile). */
const FUNCTION_SIGNATURE_SET: Readonly<Record<FunctionSignature, true>> = {
	"app_system_operation()": true,
	"app_rls_bypass()": true,
	"app_current_user_id()": true,
	"app_current_tenant_id()": true,
	"app_owns(text)": true,
	"app_rls_bypass_on(text)": true,
	"app_member_of(text)": true,
	"app_tenant_member_of(text)": true,
	"app_tenant_org_member(text)": true,
	"app_tenant_has_location_access(text)": true,
	"app_tenant_row_org_location_access(text, text)": true,
	"app_tenant_org_optional_location_access(text, text)": true,
	"app_has_permission(text, text, text, text)": true,
	"app_permitted_tenants(text, text)": true,
	"app_permitted_stores(text, text)": true,
	"app_shared(text, text, text)": true,
	"app_holds_reward_claim(text)": true,
	"app_current_api_key_id()": true,
	"app_current_api_key_location_id()": true,
	"app_api_key_org_access(text)": true,
	"app_api_key_store_access(text, text)": true,
	"app_api_key_reward_access(text)": true,
	"app_api_key_signup_referee_access(text)": true,
	"app_api_key_customer_access(text)": true,
	"app_stamp_authorization_change()": true,
	"audit_trail_notify()": true,
	"public.app_purge_audit_batch(text, bigint, integer, boolean)": true,
	"public.app_mask_personal_json(jsonb, text)": true,
	"public.app_mask_erased_person(text, text)": true,
};

/** Every declared signature (generated-sql.spec.ts proves each is defined exactly once). */
export const FUNCTION_SIGNATURES: readonly string[] = Object.keys(FUNCTION_SIGNATURE_SET);

/**
 * One PostgreSQL function the security SQL defines: a building block of `02-functions.sql`.
 *
 * `definition` is the complete `CREATE OR REPLACE FUNCTION … $$;` statement (and its `COMMENT ON
 * FUNCTION`, if any) written with the `sql` tag. Policies, triggers and other functions call it by name;
 * who may EXECUTE it is declared once per role in `roles.ts`.
 */
export interface SecurityFunction {
	/** The function's name, for the generated file's section heading. */
	readonly name: string;
	/** `name(argument types)`: how GRANT, REVOKE and ALTER FUNCTION name it. */
	readonly signature: FunctionSignature;
	/** One line: what it answers or does. */
	readonly description: string;
	/** The CREATE OR REPLACE FUNCTION statement (plus COMMENT ON FUNCTION), exactly as PostgreSQL runs it. */
	readonly definition: string;
	/** A role that owns the function (a SECURITY DEFINER function runs with its owner's rights). */
	readonly owner?: DatabaseRoleName;
	/** Revoke the built-in EXECUTE for PUBLIC: only the roles granted it in `roles.ts` may call it. */
	readonly revokeFromPublic?: boolean;
}
