import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/** The functions the triggers in `triggers.ts` execute. */
export const TRIGGER_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_stamp_authorization_change",
		signature: "app_stamp_authorization_change()",
		description:
			"Stamps User.authorizationChangedAt (database clock) whenever tokenVersion, isActive or isDeleted change: the durable backstop every API instance sweeps to drop cached authorization an after-commit invalidation missed.",
		definition: sql`CREATE OR REPLACE FUNCTION app_stamp_authorization_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tokenVersion" IS DISTINCT FROM OLD."tokenVersion"
     OR NEW."isActive" IS DISTINCT FROM OLD."isActive"
     OR NEW."isDeleted" IS DISTINCT FROM OLD."isDeleted" THEN
    NEW."authorizationChangedAt" := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  END IF;
  RETURN NEW;
END;
$$;`,
	},
	{
		name: "audit_trail_notify",
		signature: "audit_trail_notify()",
		description: "`NOTIFY audit_trail` with only the table name (never a row's content), so the admin audit log updates live; delivered on commit.",
		definition: sql`CREATE OR REPLACE FUNCTION public.audit_trail_notify() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM pg_notify('audit_trail', TG_TABLE_NAME);
  RETURN NULL;
END
$$;`,
	},
];
