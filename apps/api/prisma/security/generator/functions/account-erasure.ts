import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/**
 * Account erasure (ADR 077): masking the person in records that must stay.
 *
 * Audit and security records are kept for the ten-year retention, and the application role can't change
 * them. When an account is erased, the copies of the person's personal values inside those records (IP
 * addresses, user agents, their email, name and phone inside request bodies and change snapshots) are
 * masked by ONE function, `public.app_mask_erased_person`, which runs with the rights of `app_erasure`, a
 * NOLOGIN role whose policies name it alone. `app_runtime` may only EXECUTE it, and the function refuses:
 *
 *   * outside the `privacy.account.erase` system operation;
 *   * a person with no PENDING erasure that is already due (so it can't be pointed at anyone early).
 *
 * Ids stay (they point at the "Deleted user" tombstone); only copied personal values change.
 *
 * Rollback / recovery: `DROP FUNCTION public.app_mask_erased_person(text, text);`,
 * `DROP FUNCTION public.app_mask_personal_json(jsonb, text);`, then `DROP OWNED BY app_erasure; DROP ROLE
 * app_erasure;`. Masked values are not recoverable except from a backup taken before the erasure.
 */
export const ACCOUNT_ERASURE_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_mask_personal_json",
		signature: "public.app_mask_personal_json(jsonb, text)",
		description: 'A JSON value with every personal field (by name) and every mention of the person\'s email replaced by "[erased]", at any depth. Pure.',
		definition: sql`CREATE OR REPLACE FUNCTION public.app_mask_personal_json(value jsonb, person_email text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  personal_keys CONSTANT text[] := ARRAY[
    'email', 'fullName', 'phone', 'displayName', 'ipAddress', 'lastIpAddress', 'ip', 'userAgent',
    'deviceName', 'payerName', 'payerEmail', 'contactPhone', 'contactEmail', 'passwordHash', 'refereeIp'
  ];
  result jsonb;
  item record;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  CASE jsonb_typeof(value)
    WHEN 'object' THEN
      result := '{}'::jsonb;
      FOR item IN SELECT key, entry FROM jsonb_each(value) AS e(key, entry) LOOP
        IF item.key = ANY (personal_keys) AND jsonb_typeof(item.entry) <> 'null' THEN
          result := result || jsonb_build_object(item.key, '[erased]');
        ELSE
          result := result || jsonb_build_object(item.key, public.app_mask_personal_json(item.entry, person_email));
        END IF;
      END LOOP;
      RETURN result;
    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(public.app_mask_personal_json(element, person_email)), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) AS a(element);
      RETURN result;
    WHEN 'string' THEN
      IF person_email IS NOT NULL AND position(lower(person_email) IN lower(value #>> '{}')) > 0 THEN
        RETURN to_jsonb('[erased]'::text);
      END IF;
      RETURN value;
    ELSE
      RETURN value;
  END CASE;
END;
$$;`,
	},
	{
		name: "app_mask_erased_person",
		signature: "public.app_mask_erased_person(text, text)",
		description: "Masks the person in every kept record; returns how many rows changed.",
		owner: "app_erasure",
		revokeFromPublic: true,
		definition: sql`CREATE OR REPLACE FUNCTION public.app_mask_erased_person(person_id text, person_email text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  masked bigint := 0;
  changed bigint;
  now_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  erased constant text := '[erased]';
BEGIN
  IF public.app_system_operation() IS DISTINCT FROM 'privacy.account.erase' THEN
    RAISE EXCEPTION 'app_mask_erased_person runs only under the privacy.account.erase system operation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."AccountErasure" e
    WHERE e."userId" = person_id AND e.status = 'PENDING' AND e."isDeleted" = false AND e."scheduledFor" <= now_ms
  ) THEN
    RAISE EXCEPTION 'no due erasure for %', person_id USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public."AuditLog" r SET
    "ipAddress" = NULL, "userAgent" = NULL, "browserName" = NULL, "osName" = NULL,
    "requestHeaders" = public.app_mask_personal_json(r."requestHeaders", person_email),
    "requestParams" = public.app_mask_personal_json(r."requestParams", person_email),
    "requestBody" = public.app_mask_personal_json(r."requestBody", person_email),
    "responseBody" = public.app_mask_personal_json(r."responseBody", person_email),
    "errorDetail" = public.app_mask_personal_json(r."errorDetail", person_email)
  WHERE r."actorUserId" = person_id OR r."impersonatorUserId" = person_id
     OR position(lower(person_email) IN lower(coalesce(r."requestBody"::text, '') || coalesce(r."responseBody"::text, ''))) > 0;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;

  UPDATE public."DataChangeLog" r SET
    "oldData" = public.app_mask_personal_json(r."oldData", person_email),
    "newData" = public.app_mask_personal_json(r."newData", person_email)
  WHERE (r."tableName" = 'User' AND r."rowId" = person_id)
     OR r."actorUserId" = person_id
     OR r."oldData" ->> 'userId' = person_id OR r."newData" ->> 'userId' = person_id
     OR position(lower(person_email) IN lower(coalesce(r."oldData"::text, '') || coalesce(r."newData"::text, ''))) > 0;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;

  UPDATE public."MarketingConsent" SET ip = NULL, "userAgent" = NULL WHERE "userId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."ImpersonationAuditLog" SET "ipAddress" = NULL, "userAgent" = NULL WHERE "targetUserId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."ImpersonationSession" SET "ipAddress" = NULL, "userAgent" = NULL WHERE "targetUserId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."MfaRecoveryAuditLog" SET "ipAddress" = NULL, "userAgent" = NULL WHERE "subjectUserId" = person_id OR "actorUserId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."AuthorizationAudit" r SET "ipAddress" = NULL, "userAgent" = NULL, evaluation = public.app_mask_personal_json(r.evaluation, person_email)
  WHERE r."actorId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."EmailLog" r SET "to" = erased, metadata = public.app_mask_personal_json(r.metadata, person_email)
  WHERE lower(r."to") = lower(person_email);
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;
  UPDATE public."Notification" r SET "recipientKey" = erased, payload = public.app_mask_personal_json(r.payload, person_email)
  WHERE r."recipientUserId" = person_id;
  GET DIAGNOSTICS changed = ROW_COUNT; masked := masked + changed;

  RETURN masked;
END;
$$;`,
	},
];
