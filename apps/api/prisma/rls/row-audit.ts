/**
 * Row audit columns, filled by the database (the base model in prisma/schema.prisma).
 *
 * Every table carries the base model's `createdBy`, `updatedBy`, `updatedAt`, `isDeleted`, `deletedAt` and
 * `deletedBy`. A `row_audit` BEFORE trigger on each table fills them from the session, so no write path —
 * repository, raw SQL, seed or job — can forget them:
 *
 * - INSERT: `createdBy` / `updatedBy` default to the session's actor; a row inserted already deleted gets
 *   `isDeleted`, `deletedAt` and `deletedBy` made coherent.
 * - UPDATE: `updatedAt` (epoch ms, database clock) and `updatedBy` are stamped unless the statement set them
 *   itself; a row that becomes deleted (`isDeleted` turned on, or `deletedAt` set) gets all three soft-delete
 *   columns coherent.
 *
 * The actor (`app_current_actor()`) is the session's user id, else `api_key:<id>` for a merchant API key, else
 * `system:<operation>` for an allowlisted system operation, else the connection's `app.actor` (the seed sets
 * `system:seed`). Values the statement supplies are never overwritten.
 *
 * Both functions pin `search_path`, because the trigger also fires inside other SECURITY DEFINER functions (the
 * data-change capture writes `DataChangeLog` rows) whose own search path does not include `public`.
 *
 * `prisma/rls/apply.ts` plans the triggers against the live catalog after the RLS files, installs them and
 * verifies them; a table missing a base column fails the apply (every model must extend `BaseModel`).
 */

/** Prisma's bookkeeping table, never audited. */
const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";

export const ROW_AUDIT_TRIGGER = "row_audit";
export const ROW_AUDIT_FUNCTION = "app_stamp_row_audit";
export const CURRENT_ACTOR_FUNCTION = "app_current_actor";

/** The connection setting a process without an RLS session (the seed) names itself by. */
export const ACTOR_SETTING = "app.actor";
/** The actor the seed's writes are recorded as. */
export const SEED_ACTOR = "system:seed";

/** The base model columns the trigger writes. */
export const ROW_AUDIT_COLUMNS: readonly string[] = ["createdBy", "updatedBy", "updatedAt", "isDeleted", "deletedAt", "deletedBy"];

/** Table names interpolated into the generated SQL. */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** One table as the catalog reports it. */
export interface RowAuditCatalogTable {
	readonly name: string;
	readonly columns: readonly string[];
}

export interface RowAuditPlan {
	/** Tables that get the trigger. */
	readonly audited: readonly string[];
	/** Tables missing base columns: the apply fails on them. */
	readonly missing: readonly { readonly table: string; readonly columns: readonly string[] }[];
}

/** Thrown when a table name is not safe to interpolate. */
export class RowAuditPlanError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "RowAuditPlanError";
	}
}

/** Which tables get the trigger, and which lack a base column. */
export function planRowAudit(catalog: readonly RowAuditCatalogTable[]): RowAuditPlan {
	const audited: string[] = [];
	const missing: { table: string; columns: string[] }[] = [];
	for (const table of catalog) {
		if (table.name === PRISMA_MIGRATIONS_TABLE) {
			continue;
		}
		const lacking = ROW_AUDIT_COLUMNS.filter((column: string): boolean => !table.columns.includes(column));
		if (lacking.length > 0) {
			missing.push({ table: table.name, columns: lacking });
		} else {
			audited.push(table.name);
		}
	}
	return { audited: audited.sort((a, b): number => a.localeCompare(b)), missing };
}

/** The actor function and the trigger function. */
function functionsSql(): string {
	return `CREATE OR REPLACE FUNCTION public.${CURRENT_ACTOR_FUNCTION}() RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    app_current_user_id(),
    'api_key:' || app_current_api_key_id(),
    'system:' || app_system_operation(),
    NULLIF(current_setting('${ACTOR_SETTING}', true), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.${ROW_AUDIT_FUNCTION}() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  actor text := ${CURRENT_ACTOR_FUNCTION}();
  now_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  becomes_deleted boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."createdBy" := COALESCE(NEW."createdBy", actor);
    NEW."updatedBy" := COALESCE(NEW."updatedBy", NEW."createdBy");
    becomes_deleted := NEW."isDeleted" OR NEW."deletedAt" IS NOT NULL;
  ELSE
    IF NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := now_ms;
    END IF;
    IF NEW."updatedBy" IS NOT DISTINCT FROM OLD."updatedBy" AND actor IS NOT NULL THEN
      NEW."updatedBy" := actor;
    END IF;
    becomes_deleted := (NEW."isDeleted" AND NOT OLD."isDeleted") OR (NEW."deletedAt" IS NOT NULL AND OLD."deletedAt" IS NULL);
  END IF;
  IF becomes_deleted THEN
    NEW."isDeleted" := true;
    NEW."deletedAt" := COALESCE(NEW."deletedAt", now_ms);
    NEW."deletedBy" := COALESCE(NEW."deletedBy", actor);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_enumerator', 'analytics_consumer'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.${CURRENT_ACTOR_FUNCTION}() TO %I', role_name);
    END IF;
  END LOOP;
END $$;`;
}

function triggerSql(table: string): string {
	if (!SAFE_IDENTIFIER.test(table)) {
		throw new RowAuditPlanError(`Unsafe table name in the row audit plan: ${table}`);
	}
	return `DROP TRIGGER IF EXISTS ${ROW_AUDIT_TRIGGER} ON public."${table}";
CREATE TRIGGER ${ROW_AUDIT_TRIGGER} BEFORE INSERT OR UPDATE ON public."${table}"
  FOR EACH ROW EXECUTE FUNCTION public.${ROW_AUDIT_FUNCTION}();`;
}

/** The functions, then one trigger per audited table. */
export function buildRowAuditSql(plan: RowAuditPlan): string {
	return [functionsSql(), ...plan.audited.map(triggerSql)].join("\n\n");
}
