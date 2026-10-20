/**
 * Row-level data-change capture — the declared manifest and the SQL it generates
 * (docs/adr/051-database-change-audit-trail.md).
 *
 * Every table in `public` gets a `data_change_capture` trigger that records each
 * INSERT / UPDATE / DELETE (and a statement-level one for TRUNCATE) in
 * `DataChangeLog`, in the same transaction as the change. Capture is the
 * DEFAULT: a table created by a later migration is captured the next time
 * `pnpm db:apply-security` runs (it is chained after every migrate / deploy /
 * reset / push). The only ways out are declared HERE, with a reason:
 *
 * - {@link DATA_CHANGE_CAPTURE_EXEMPTIONS} — tables that are themselves audit
 *   trails, logs or messaging / cache plumbing.
 * - {@link DATA_CHANGE_SECRET_COLUMNS} — columns whose value never enters a
 *   change record (`[REDACTED]`); a change to one is still listed in
 *   `changedColumns`.
 * - {@link DATA_CHANGE_NON_SECRET_COLUMNS} — columns whose NAME looks secret
 *   ({@link SECRET_LOOKING_COLUMN}) but whose value is not, with the reason.
 *
 * Personal data is masked by column name with the SAME policy the HTTP audit
 * trail applies to payloads (`src/platform/infrastructure/audit/audit-data-policy.ts`), and the
 * value-size cap and mask strings are interpolated from the same constants, so
 * the TypeScript and SQL sides cannot drift.
 *
 * {@link planDataChangeCapture} refuses a manifest that names an unknown
 * table / column or leaves a secret-looking column unclassified — at apply
 * time against the live catalog (`prisma/rls/apply.ts`) and in CI against
 * the Prisma schema (`pnpm db:check-rls-manifest`).
 */

import { AUDIT_PAYLOAD_MAX_BYTES, isEmailField, isPersonalDataField, PII_MASK } from "../../src/platform/infrastructure/audit/audit-data-policy";
import { REDACTED } from "../../src/platform/infrastructure/nest-logging/redaction";

/** Prisma's own bookkeeping table: not part of `schema.prisma`, never captured. */
export const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";

/** The table the triggers append to. */
export const DATA_CHANGE_LOG_TABLE = "DataChangeLog";

/** Row-level trigger (INSERT / UPDATE / DELETE) on every captured table. */
export const DATA_CHANGE_ROW_TRIGGER = "data_change_capture";

/** Statement-level trigger (TRUNCATE) on every captured table. */
export const DATA_CHANGE_TRUNCATE_TRIGGER = "data_change_capture_truncate";

/** The trigger function (SECURITY INVOKER: `current_user` is the role that wrote the row). */
export const DATA_CHANGE_CAPTURE_FUNCTION = "app_capture_data_change";

/** Redacts / masks / caps one row image. */
export const DATA_CHANGE_IMAGE_FUNCTION = "app_data_change_image";

/** Separator of a composite primary key in `rowId` (and of the column lists passed as trigger arguments). */
export const ROW_ID_SEPARATOR = "/";
const TRIGGER_ARGUMENT_LIST_SEPARATOR = ",";

/** Column budgets of `DataChangeLog` (prisma/schema.prisma `DataChangeLog`). */
const COLUMN_BUDGET = {
	rowId: 512,
	identifier: 64,
	systemOperation: 100,
	actorPurpose: 512,
	roleName: 63,
	applicationName: 64,
	clientAddress: 64,
} satisfies Record<string, number>;

/** Shortest reason a reviewer will accept for an exemption / non-secret classification. */
export const MIN_DATA_CHANGE_REASON_LENGTH = 40;

/**
 * A column name that suggests secret material. A captured table's column that
 * matches must be classified — secret ({@link DATA_CHANGE_SECRET_COLUMNS}) or
 * not ({@link DATA_CHANGE_NON_SECRET_COLUMNS}) — or the apply / CI check fails,
 * so a new credential column can never be copied into the trail by default.
 */
export const SECRET_LOOKING_COLUMN = /hash|secret|cipher|token|digest|passw|salt|wrapped|nonce|signature|credential|otp|_iv$/i;

const AUDIT_TRAIL_REASON = "An append-only audit trail of its own: each row already IS the record of an action whose business rows are captured.";
const LOG_REASON = "A log sink written as a side effect of other actions; the actions themselves are captured and the HTTP audit trail records each request.";
const MESSAGING_REASON = "Messaging plumbing (outbox / inbox bookkeeping) that mirrors domain writes already captured on their own tables.";

/** Tables never captured, each with the reason. Everything else in `public` is. */
export const DATA_CHANGE_CAPTURE_EXEMPTIONS: Readonly<Record<string, string>> = {
	[DATA_CHANGE_LOG_TABLE]: "The change trail itself: capturing its own inserts would recurse without end.",
	AuditLog: "The HTTP audit trail (ADR 025): one row per request, joined to these changes by correlation id.",
	PermissionAuditLog: AUDIT_TRAIL_REASON,
	MfaRecoveryAuditLog: AUDIT_TRAIL_REASON,
	ImpersonationAuditLog: AUDIT_TRAIL_REASON,
	AuthorizationAudit: `${AUDIT_TRAIL_REASON} One row per authorization decision (a read-path record).`,
	TenantAuditLog: AUDIT_TRAIL_REASON,
	RewardAuditLog: AUDIT_TRAIL_REASON,
	EmailLog: LOG_REASON,
	EmailDeliveryEvent: LOG_REASON,
	GithubWebhookDelivery: `${LOG_REASON} One row per GitHub webhook delivery, kept to ignore redeliveries.`,
	AnalyticsEvent: "Telemetry projected from domain events by the analytics consumer; the domain writes behind each event are captured.",
	OutboxEvent: MESSAGING_REASON,
	InboxProcessedEvent: MESSAGING_REASON,
	InboxDeadLetter: MESSAGING_REASON,
	PlatformResourceIdempotencyRecord: "Idempotency-Key replay cache (expired rows are taken over in place); the request it replays is in the HTTP audit trail.",
};

/** Columns whose value never enters a change record — credentials, key material and their digests. */
export const DATA_CHANGE_SECRET_COLUMNS: Readonly<Record<string, readonly string[]>> = {
	User: ["passwordHash", "twoFactorSecretCiphertext", "twoFactorSecretIv", "pendingAttributionToken"],
	PasswordHistory: ["passwordHash"],
	PasswordResetToken: ["token", "tokenDigest"],
	BackupCode: ["codeHash"],
	TwoFactorPendingSetup: ["secretCiphertext", "secretIv", "backupCodesHashes"],
	RefreshToken: ["token", "previousTokenHash"],
	TenantApiKey: ["keyHash"],
	TenantInvitation: ["tokenHash"],
	TenantTerminal: ["pairingCodeHash"],
	RewardClaim: ["redemptionTokenHash", "backupCodeHash"],
	RewardOtpChallenge: ["codeHash"],
	RewardReferral: ["attributionToken", "refereeDeviceHash"],
	TenantEncryptionKey: ["wrappedKey"],
	GithubAccountLink: ["tokenCiphertext"],
};

const KEY_VERSION_REASON = "The version number of the key that encrypted a secret: it names a key and holds no key material.";

/** Columns whose name matches {@link SECRET_LOOKING_COLUMN} but whose value is not secret — kept in change records. */
export const DATA_CHANGE_NON_SECRET_COLUMNS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	User: {
		tokenVersion: "A counter bumped to revoke every issued token at once; a number, never a credential.",
		twoFactorLastTotpStep: "The last accepted TOTP time step (the replay guard): a counter, not the TOTP secret or a code.",
		twoFactorSecretKeyVersion: KEY_VERSION_REASON,
	},
	TwoFactorPendingSetup: {
		secretKeyVersion: KEY_VERSION_REASON,
	},
	GithubAccountLink: {
		tokenKeyVersion: KEY_VERSION_REASON,
		tokenExpiresAt: "When GitHub expires the linked token (epoch ms): a date the app shows to its owner, not part of the credential.",
	},
	AuthorizationPolicyVersion: {
		contentHash: "SHA-256 of a published authorization policy document: identifies the version, derived from non-secret content.",
	},
	RewardSale: {
		requestHash: "Fingerprint of a POS sale request used to detect idempotent replays; derived from the sale body, not from a credential.",
	},
};

/** The declared manifest {@link planDataChangeCapture} applies (injectable for tests). */
export interface DataChangeCaptureManifest {
	readonly exemptions: Readonly<Record<string, string>>;
	readonly secretColumns: Readonly<Record<string, readonly string[]>>;
	readonly nonSecretColumns: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export const DATA_CHANGE_CAPTURE_MANIFEST: DataChangeCaptureManifest = {
	exemptions: DATA_CHANGE_CAPTURE_EXEMPTIONS,
	secretColumns: DATA_CHANGE_SECRET_COLUMNS,
	nonSecretColumns: DATA_CHANGE_NON_SECRET_COLUMNS,
};

/** One table as the catalog (live database or Prisma schema) describes it. */
export interface DataChangeCatalogTable {
	readonly name: string;
	/** Primary-key columns in key order; empty when the source does not know them (the schema-only CI check). */
	readonly primaryKeyColumns: readonly string[];
	readonly columns: readonly string[];
}

/** One captured table and the column lists its trigger is created with. */
export interface CapturedTable {
	readonly name: string;
	readonly primaryKeyColumns: readonly string[];
	readonly secretColumns: readonly string[];
	readonly personalColumns: readonly string[];
	readonly emailColumns: readonly string[];
}

/** What `db:apply-security` installs: captured tables get both triggers, exempt tables get neither. */
export interface DataChangeCapturePlan {
	readonly captured: readonly CapturedTable[];
	readonly exempt: readonly string[];
}

/** Thrown when the manifest disagrees with the catalog; lists every problem at once. */
export class DataChangeCaptureManifestError extends Error {
	public constructor(public readonly problems: readonly string[]) {
		super(`Data-change capture manifest (prisma/rls/data-change-capture.ts) is out of date:\n  - ${problems.join("\n  - ")}`);
		this.name = "DataChangeCaptureManifestError";
	}
}

/** A PostgreSQL identifier this module will interpolate into SQL (Prisma column names may be camelCase). */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function byName(left: string, right: string): number {
	return left.localeCompare(right);
}

/** One problem per entry whose reason is too short; `label` names the entry in the message. */
function shortReasons(entries: Readonly<Record<string, string>>, label: (name: string) => string): string[] {
	return Object.entries(entries)
		.filter(([, reason]: [string, string]): boolean => reason.trim().length < MIN_DATA_CHANGE_REASON_LENGTH)
		.map(([name]: [string, string]): string => `${label(name)}: the reason must be a real sentence (at least ${String(MIN_DATA_CHANGE_REASON_LENGTH)} characters)`);
}

/**
 * Every disagreement between the manifest and the catalog: unknown tables or
 * columns, unsafe identifiers, columns classified both ways, short reasons and
 * secret-looking columns of captured tables that nobody classified.
 */
export function findDataChangeManifestProblems(tables: readonly DataChangeCatalogTable[], manifest: DataChangeCaptureManifest = DATA_CHANGE_CAPTURE_MANIFEST): string[] {
	const columnsByTable = new Map<string, ReadonlySet<string>>(
		tables.map((table: DataChangeCatalogTable): [string, ReadonlySet<string>] => [table.name, new Set(table.columns)]),
	);
	const exempt: ReadonlySet<string> = new Set(Object.keys(manifest.exemptions));
	const problems: string[] = [];

	for (const table of tables) {
		for (const name of [table.name, ...table.columns]) {
			if (!SAFE_IDENTIFIER.test(name)) {
				problems.push(`${table.name}: "${name}" is not a plain identifier, so it cannot be passed to the capture trigger`);
			}
		}
	}

	for (const table of exempt) {
		if (!columnsByTable.has(table)) {
			problems.push(`exemption names unknown table ${table}`);
		}
	}
	problems.push(...shortReasons(manifest.exemptions, (table: string): string => `exemption ${table}`));

	const classified = new Map<string, "secret" | "not secret">();
	const declare = (kind: "secret" | "not secret", table: string, columns: readonly string[]): void => {
		const known = columnsByTable.get(table);
		if (known === undefined) {
			problems.push(`${kind} column list names unknown table ${table}`);
			return;
		}
		if (exempt.has(table)) {
			problems.push(`${table} is exempt from capture, so classifying its columns as ${kind} has no effect — remove the entry`);
		}
		for (const column of columns) {
			const key = `${table}.${column}`;
			if (!known.has(column)) {
				problems.push(`${kind} column ${key} does not exist`);
			}
			const previous = classified.get(key);
			if (previous !== undefined && previous !== kind) {
				problems.push(`${key} is classified both as secret and as not secret`);
			}
			classified.set(key, kind);
		}
	};
	for (const [table, columns] of Object.entries(manifest.secretColumns)) {
		declare("secret", table, columns);
	}
	for (const [table, reasons] of Object.entries(manifest.nonSecretColumns)) {
		declare("not secret", table, Object.keys(reasons));
		problems.push(...shortReasons(reasons, (column: string): string => `not-secret column ${table}.${column}`));
	}

	for (const table of tables) {
		if (exempt.has(table.name)) {
			continue;
		}
		for (const column of table.columns) {
			if (SECRET_LOOKING_COLUMN.test(column) && !classified.has(`${table.name}.${column}`)) {
				problems.push(
					`${table.name}.${column} looks like secret material but is not classified — add it to DATA_CHANGE_SECRET_COLUMNS, or to DATA_CHANGE_NON_SECRET_COLUMNS with the reason its value is safe to keep`,
				);
			}
		}
	}

	return problems.sort(byName);
}

/**
 * The capture plan for a catalog: which tables get the triggers and the column
 * lists each trigger is created with. Throws {@link DataChangeCaptureManifestError}
 * listing every problem when the manifest disagrees with the catalog.
 */
export function planDataChangeCapture(tables: readonly DataChangeCatalogTable[], manifest: DataChangeCaptureManifest = DATA_CHANGE_CAPTURE_MANIFEST): DataChangeCapturePlan {
	const problems: string[] = findDataChangeManifestProblems(tables, manifest);
	if (problems.length > 0) {
		throw new DataChangeCaptureManifestError(problems);
	}
	const exempt: ReadonlySet<string> = new Set(Object.keys(manifest.exemptions));
	const domainTables: DataChangeCatalogTable[] = tables.filter((table: DataChangeCatalogTable): boolean => table.name !== PRISMA_MIGRATIONS_TABLE);
	const captured: CapturedTable[] = domainTables
		.filter((table: DataChangeCatalogTable): boolean => !exempt.has(table.name))
		.map((table: DataChangeCatalogTable): CapturedTable => ({
			name: table.name,
			primaryKeyColumns: table.primaryKeyColumns,
			secretColumns: [...(manifest.secretColumns[table.name] ?? [])].sort(byName),
			personalColumns: table.columns.filter((column: string): boolean => isPersonalDataField(column) && !isEmailField(column)).sort(byName),
			emailColumns: table.columns.filter((column: string): boolean => isEmailField(column)).sort(byName),
		}))
		.sort((left: CapturedTable, right: CapturedTable): number => byName(left.name, right.name));
	return {
		captured,
		exempt: domainTables
			.map((table: DataChangeCatalogTable): string => table.name)
			.filter((name: string): boolean => exempt.has(name))
			.sort(byName),
	};
}

// ── SQL generation ──────────────────────────────────────────────────────────

/** A SQL string literal (standard_conforming_strings: only `'` needs escaping). */
function sqlLiteral(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/** A double-quoted SQL identifier (callers pass only {@link SAFE_IDENTIFIER} names). */
function sqlIdentifier(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

/** A trigger argument holding a column list (names are {@link SAFE_IDENTIFIER}s: no separator inside). */
function columnListArgument(columns: readonly string[]): string {
	return sqlLiteral(columns.join(TRIGGER_ARGUMENT_LIST_SEPARATOR));
}

/**
 * The two functions every trigger calls. `app_data_change_image` applies the
 * audit data policy to one row image: secret columns → `[REDACTED]`, email
 * columns → first character + `***` + domain, other personal data → `[PII]`,
 * any value larger than the payload cap → `{ truncated, originalBytes }`; JSON
 * `null` stays `null`. `app_capture_data_change` builds and appends the record.
 */
export function buildDataChangeFunctionsSql(): string {
	const sessionValue = (setting: string): string => `NULLIF(current_setting(${sqlLiteral(setting)}, true), '')`;
	return `
CREATE OR REPLACE FUNCTION public.${DATA_CHANGE_IMAGE_FUNCTION}(image jsonb, secret_columns text[], personal_columns text[], email_columns text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $fn$
  SELECT jsonb_object_agg(
    entry.key,
    CASE
      WHEN entry.value = 'null'::jsonb THEN entry.value
      WHEN entry.key = ANY (secret_columns) THEN to_jsonb(${sqlLiteral(REDACTED)}::text)
      WHEN entry.key = ANY (email_columns) AND position('@' IN (entry.value #>> '{}')) > 1
        THEN to_jsonb(left(entry.value #>> '{}', 1) || '***' || substring(entry.value #>> '{}' FROM '@[^@]*$'))
      WHEN entry.key = ANY (email_columns) OR entry.key = ANY (personal_columns) THEN to_jsonb(${sqlLiteral(PII_MASK)}::text)
      WHEN octet_length(entry.value::text) > ${String(AUDIT_PAYLOAD_MAX_BYTES)}
        THEN jsonb_build_object('truncated', true, 'originalBytes', octet_length(entry.value::text))
      ELSE entry.value
    END
  )
  FROM jsonb_each(image) AS entry
$fn$;

CREATE OR REPLACE FUNCTION public.${DATA_CHANGE_CAPTURE_FUNCTION}()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE
  primary_key_columns text[] := string_to_array(TG_ARGV[0], ${sqlLiteral(TRIGGER_ARGUMENT_LIST_SEPARATOR)});
  secret_columns text[] := string_to_array(TG_ARGV[1], ${sqlLiteral(TRIGGER_ARGUMENT_LIST_SEPARATOR)});
  personal_columns text[] := string_to_array(TG_ARGV[2], ${sqlLiteral(TRIGGER_ARGUMENT_LIST_SEPARATOR)});
  email_columns text[] := string_to_array(TG_ARGV[3], ${sqlLiteral(TRIGGER_ARGUMENT_LIST_SEPARATOR)});
  "actorUserId" text := ${sessionValue("app.current_user_id")};
  "apiKeyId" text := ${sessionValue("app.current_api_key_id")};
  "systemOperation" text := ${sessionValue("app.system_operation")};
  old_image jsonb;
  new_image jsonb;
  "changedColumns" text[] := ARRAY[]::text[];
  "rowId" text;
BEGIN
  IF TG_LEVEL = 'ROW' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_image := to_jsonb(OLD);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_image := to_jsonb(NEW);
    END IF;
    IF TG_OP = 'UPDATE' THEN
      -- Compared BEFORE redaction, so a changed secret column is still listed.
      SELECT COALESCE(array_agg(entry.key ORDER BY entry.key), ARRAY[]::text[])
        INTO "changedColumns"
        FROM jsonb_each(new_image) AS entry
       WHERE entry.value IS DISTINCT FROM old_image -> entry.key;
    END IF;
    SELECT string_agg(COALESCE(new_image, old_image) ->> key_column.name, ${sqlLiteral(ROW_ID_SEPARATOR)} ORDER BY key_column.position)
      INTO "rowId"
      FROM unnest(primary_key_columns) WITH ORDINALITY AS key_column(name, position);
  END IF;

  INSERT INTO public."${DATA_CHANGE_LOG_TABLE}" (
    "occurredAt", "transactionId", "tableName", operation, "rowId", "changedColumns", "oldData", "newData",
    "actorKind", "actorUserId", "tenantId", "apiKeyId", "systemOperation", "actorPurpose", "correlationId",
    "databaseRole", "loginRole", "applicationName", "clientAddress"
  ) VALUES (
    (EXTRACT(epoch FROM clock_timestamp()) * 1000)::bigint,
    txid_current(),
    TG_TABLE_NAME,
    TG_OP::public."DataChangeOperation",
    left("rowId", ${String(COLUMN_BUDGET.rowId)}),
    "changedColumns",
    public.${DATA_CHANGE_IMAGE_FUNCTION}(old_image, secret_columns, personal_columns, email_columns),
    public.${DATA_CHANGE_IMAGE_FUNCTION}(new_image, secret_columns, personal_columns, email_columns),
    (CASE
      WHEN "actorUserId" IS NOT NULL THEN 'USER'
      WHEN "apiKeyId" IS NOT NULL THEN 'API_KEY'
      WHEN "systemOperation" IS NOT NULL THEN 'SYSTEM'
      ELSE 'UNATTRIBUTED'
    END)::public."DataChangeActorKind",
    left("actorUserId", ${String(COLUMN_BUDGET.identifier)}),
    left(${sessionValue("app.current_tenant_id")}, ${String(COLUMN_BUDGET.identifier)}),
    left("apiKeyId", ${String(COLUMN_BUDGET.identifier)}),
    left("systemOperation", ${String(COLUMN_BUDGET.systemOperation)}),
    left(${sessionValue("app.actor_purpose")}, ${String(COLUMN_BUDGET.actorPurpose)}),
    left(${sessionValue("app.correlation_id")}, ${String(COLUMN_BUDGET.identifier)}),
    left(current_user, ${String(COLUMN_BUDGET.roleName)}),
    left(session_user, ${String(COLUMN_BUDGET.roleName)}),
    left(${sessionValue("application_name")}, ${String(COLUMN_BUDGET.applicationName)}),
    left(host(inet_client_addr()), ${String(COLUMN_BUDGET.clientAddress)})
  );
  RETURN NULL;
END
$fn$;
`;
}

function dropTriggersSql(table: string): string {
	return [
		`DROP TRIGGER IF EXISTS ${DATA_CHANGE_ROW_TRIGGER} ON public.${sqlIdentifier(table)};`,
		`DROP TRIGGER IF EXISTS ${DATA_CHANGE_TRUNCATE_TRIGGER} ON public.${sqlIdentifier(table)};`,
	].join("\n");
}

function createTriggersSql(table: CapturedTable): string {
	const argumentsSql: string = [table.primaryKeyColumns, table.secretColumns, table.personalColumns, table.emailColumns].map(columnListArgument).join(", ");
	return [
		dropTriggersSql(table.name),
		`CREATE TRIGGER ${DATA_CHANGE_ROW_TRIGGER} AFTER INSERT OR UPDATE OR DELETE ON public.${sqlIdentifier(table.name)} FOR EACH ROW EXECUTE FUNCTION public.${DATA_CHANGE_CAPTURE_FUNCTION}(${argumentsSql});`,
		`CREATE TRIGGER ${DATA_CHANGE_TRUNCATE_TRIGGER} AFTER TRUNCATE ON public.${sqlIdentifier(table.name)} FOR EACH STATEMENT EXECUTE FUNCTION public.${DATA_CHANGE_CAPTURE_FUNCTION}(${argumentsSql});`,
	].join("\n");
}

/**
 * The complete, idempotent capture SQL for a plan: the two functions, both
 * triggers (re)created on every captured table, and both dropped from every
 * exempt one — so exempting a table removes its triggers on the next apply.
 */
export function buildDataChangeCaptureSql(plan: DataChangeCapturePlan): string {
	return [buildDataChangeFunctionsSql(), ...plan.captured.map(createTriggersSql), ...plan.exempt.map(dropTriggersSql)].join("\n\n");
}
