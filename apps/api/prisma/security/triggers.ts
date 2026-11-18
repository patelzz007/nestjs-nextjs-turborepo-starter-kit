import { sql } from "./sql";
import type { TableName } from "./table-types";

/**
 * The hand-picked triggers of the security SQL — the source of `prisma/rls/03-triggers.sql`. Each is
 * dropped and re-created on every apply, so changing one here changes it everywhere.
 *
 * Not listed here: the data-change capture and row audit triggers. They go on (nearly) every table and are
 * planned against the live catalog by data-change-capture.ts and row-audit.ts when `db:apply-security` runs.
 */
export interface SecurityTrigger {
	/** The trigger's name (unique per table). */
	readonly name: string;
	/** The table it is attached to (a Prisma model name). */
	readonly table: TableName;
	/** Why it exists, in one line (a comment in the generated SQL). */
	readonly purpose: string;
	/** The CREATE TRIGGER statement. */
	readonly definition: string;
}

export const SECURITY_TRIGGERS: readonly SecurityTrigger[] = [
	{
		name: "users_authorization_change_stamp",
		table: "User",
		purpose:
			"Turns every change to an account's access (tokenVersion, isActive, isDeleted) into an epoch-ms stamp in User.authorizationChangedAt, committed with the change: the backstop the AuthorizationChangeSweep reads.",
		definition: sql`CREATE TRIGGER users_authorization_change_stamp
  BEFORE UPDATE OF "tokenVersion", "isActive", "isDeleted" ON public."User"
  FOR EACH ROW
  EXECUTE FUNCTION app_stamp_authorization_change();`,
	},
	{
		name: "audit_trail_notify",
		table: "AuditLog",
		purpose: "Signals `audit_trail` once per request row, except reads of the audit log itself (viewing the log would otherwise make every open page refetch forever).",
		definition: sql`CREATE TRIGGER audit_trail_notify
  AFTER INSERT ON public."AuditLog"
  FOR EACH ROW
  WHEN (NOT (NEW.method = 'GET' AND NEW.endpoint ~ '^/api/v[0-9]+/admin/(audit-|data-changes)'))
  EXECUTE FUNCTION public.audit_trail_notify();`,
	},
	{
		name: "audit_trail_notify",
		table: "DataChangeLog",
		purpose: "Signals `audit_trail` once per statement, so a bulk job signals once.",
		definition: sql`CREATE TRIGGER audit_trail_notify
  AFTER INSERT ON public."DataChangeLog"
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.audit_trail_notify();`,
	},
];
