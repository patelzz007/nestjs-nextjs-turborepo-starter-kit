import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/**
 * The merchant API key as a database principal. A request authenticated by a merchant API key (POS till or
 * back-office integration) runs as the `api_key` RLS context (src/prisma/rls-context.ts): no user, no
 * bypass, and these session settings, set only by the server AFTER the key lookup verified the key:
 *
 *   app.current_tenant_id            the key's tenant
 *   app.current_api_key_id           the key
 *   app.current_api_key_location_id  the key's store ('' = tenant-wide key)
 *
 * User and anonymous sessions are unaffected: app_current_api_key_id() is NULL for them, so no api-key
 * policy matches.
 */
export const API_KEY_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_current_api_key_id",
		signature: "app_current_api_key_id()",
		description: "The verified API key of the session, or NULL.",
		definition: sql`CREATE OR REPLACE FUNCTION app_current_api_key_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_api_key_id', true), '');
$$;`,
	},
	{
		name: "app_current_api_key_location_id",
		signature: "app_current_api_key_location_id()",
		description: "The store a store-scoped key is limited to, or NULL for a tenant-wide key.",
		definition: sql`CREATE OR REPLACE FUNCTION app_current_api_key_location_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_api_key_location_id', true), '');
$$;`,
	},
	{
		name: "app_api_key_org_access",
		signature: "app_api_key_org_access(text)",
		description: "The session is an API key acting for this tenant.",
		definition: sql`CREATE OR REPLACE FUNCTION app_api_key_org_access(org_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND app_current_tenant_id() IS NOT NULL
    AND org_id = app_current_tenant_id();
$$;`,
	},
	{
		name: "app_api_key_store_access",
		signature: "app_api_key_store_access(text, text)",
		description: "An API key of this tenant and, for a store-scoped key, the row belongs to the key's store (a row with no store: tenant-wide keys only).",
		definition: sql`CREATE OR REPLACE FUNCTION app_api_key_store_access(org_id text, loc_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_api_key_org_access(org_id)
    AND (app_current_api_key_location_id() IS NULL OR loc_id = app_current_api_key_location_id());
$$;`,
	},
	{
		name: "app_api_key_reward_access",
		signature: "app_api_key_reward_access(text)",
		description: "The reward belongs to the key's tenant (claims and referrals inherit it).",
		definition: sql`CREATE OR REPLACE FUNCTION app_api_key_reward_access("rewardId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public."Reward" r WHERE r.id = "rewardId" AND app_api_key_org_access(r."tenantId"));
$$;`,
	},
	{
		name: "app_api_key_signup_referee_access",
		signature: "app_api_key_signup_referee_access(text)",
		description:
			"The referee of a signup referral was just redeemed for at the key's store (ADR 035). SECURITY DEFINER so the lookup does not depend on the redemption table's own policies.",
		definition: sql`CREATE OR REPLACE FUNCTION app_api_key_signup_referee_access("refereeUserId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardRedemption" rr
      WHERE rr."userId" = "refereeUserId"
        AND rr."isDeleted" = false
        AND app_api_key_store_access(rr."tenantId", rr."locationId")
    );
$$;`,
	},
	{
		name: "app_api_key_customer_access",
		signature: "app_api_key_customer_access(text)",
		description:
			"The user is a customer of the API key's tenant (ADR 085: the till records the customer's tier). SECURITY DEFINER so the lookup does not depend on TenantCustomer's own policies.",
		definition: sql`CREATE OR REPLACE FUNCTION app_api_key_customer_access("customerUserId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."TenantCustomer" tc
      WHERE tc."userId" = "customerUserId"
        AND tc."isDeleted" = false
        AND app_api_key_org_access(tc."tenantId")
    );
$$;`,
	},
];
