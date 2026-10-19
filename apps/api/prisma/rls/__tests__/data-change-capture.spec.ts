import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { schemaTablesFromDmmf, type SchemaTable } from "../../../scripts/lib/seed-coverage";
import { AUDIT_PAYLOAD_MAX_BYTES, PII_MASK } from "../../../src/platform/infrastructure/audit/audit-data-policy";
import { REDACTED } from "../../../src/platform/infrastructure/nest-logging/redaction";
import {
	buildDataChangeCaptureSql,
	DATA_CHANGE_CAPTURE_MANIFEST,
	DATA_CHANGE_LOG_TABLE,
	DATA_CHANGE_ROW_TRIGGER,
	DATA_CHANGE_TRUNCATE_TRIGGER,
	DataChangeCaptureManifestError,
	findDataChangeManifestProblems,
	planDataChangeCapture,
	PRISMA_MIGRATIONS_TABLE,
	type DataChangeCaptureManifest,
	type DataChangeCatalogTable,
} from "../data-change-capture";

const LONG_REASON = "A reason long enough for a reviewer to judge whether it holds.";

const EMPTY_MANIFEST: DataChangeCaptureManifest = { exemptions: {}, secretColumns: {}, nonSecretColumns: {} };

function table(name: string, columns: readonly string[], primaryKeyColumns: readonly string[] = ["id"]): DataChangeCatalogTable {
	return { name, columns, primaryKeyColumns };
}

/** The tables `schema.prisma` declares, as the CI-time catalog (no primary keys needed for the manifest check). */
function schemaCatalog(): DataChangeCatalogTable[] {
	return schemaTablesFromDmmf(Prisma.dmmf.datamodel.models).map((schemaTable: SchemaTable): DataChangeCatalogTable =>
		table(schemaTable.tableName, schemaTable.columnNames, []),
	);
}

describe("the declared data-change capture manifest", () => {
	it("agrees with schema.prisma: known tables and columns, every secret-looking column classified", () => {
		expect(findDataChangeManifestProblems(schemaCatalog())).toEqual([]);
	});

	it("never captures the change trail itself or the HTTP audit trail", () => {
		const plan = planDataChangeCapture(schemaCatalog());
		const captured = plan.captured.map((capturedTable) => capturedTable.name);

		expect(captured).not.toContain(DATA_CHANGE_LOG_TABLE);
		expect(captured).not.toContain("AuditLog");
		expect(plan.exempt).toContain(DATA_CHANGE_LOG_TABLE);
	});

	it("captures the business tables a user action changes", () => {
		const captured = planDataChangeCapture(schemaCatalog()).captured.map((capturedTable) => capturedTable.name);

		expect(captured).toEqual(expect.arrayContaining(["User", "Organization", "OrganizationMembership", "Reward", "RewardClaim", "RewardRedemption", "StoredFile"]));
	});
});

describe("findDataChangeManifestProblems", () => {
	it("rejects exemptions and column lists that name unknown tables or columns", () => {
		const manifest: DataChangeCaptureManifest = {
			exemptions: { ghosts: LONG_REASON },
			secretColumns: { User: ["no_such_column"], phantoms: ["token"] },
			nonSecretColumns: {},
		};

		expect(findDataChangeManifestProblems([table("User", ["id"])], manifest)).toEqual([
			"exemption names unknown table ghosts",
			"secret column list names unknown table phantoms",
			"secret column User.no_such_column does not exist",
		]);
	});

	it("fails on a secret-looking column nobody classified, so a new credential column is never copied by default", () => {
		const problems = findDataChangeManifestProblems([table("sessions", ["id", "refresh_token_hash", "label"])], EMPTY_MANIFEST);

		expect(problems).toHaveLength(1);
		expect(problems.at(0)).toMatch(/^sessions\.refresh_token_hash looks like secret material/);
	});

	it("accepts a secret-looking column once it is classified either way", () => {
		const catalog = [table("sessions", ["id", "tokenHash", "tokenVersion"])];
		const manifest: DataChangeCaptureManifest = {
			exemptions: {},
			secretColumns: { sessions: ["tokenHash"] },
			nonSecretColumns: { sessions: { tokenVersion: LONG_REASON } },
		};

		expect(findDataChangeManifestProblems(catalog, manifest)).toEqual([]);
	});

	it("ignores unclassified columns of an exempt table, but refuses pointless classifications on it", () => {
		const catalog = [table("outbox", ["id", "leaseToken"])];

		expect(findDataChangeManifestProblems(catalog, { ...EMPTY_MANIFEST, exemptions: { outbox: LONG_REASON } })).toEqual([]);
		expect(findDataChangeManifestProblems(catalog, { exemptions: { outbox: LONG_REASON }, secretColumns: { outbox: ["leaseToken"] }, nonSecretColumns: {} })).toEqual([
			"outbox is exempt from capture, so classifying its columns as secret has no effect — remove the entry",
		]);
	});

	it("rejects a column classified as both secret and not secret", () => {
		const manifest: DataChangeCaptureManifest = { exemptions: {}, secretColumns: { keys: ["keyHash"] }, nonSecretColumns: { keys: { keyHash: LONG_REASON } } };

		expect(findDataChangeManifestProblems([table("keys", ["id", "keyHash"])], manifest)).toEqual(["keys.keyHash is classified both as secret and as not secret"]);
	});

	it("rejects placeholder reasons", () => {
		const manifest: DataChangeCaptureManifest = { exemptions: { Log: "n/a" }, secretColumns: {}, nonSecretColumns: { User: { tokenVersion: "counter" } } };

		expect(findDataChangeManifestProblems([table("Log", ["id"]), table("User", ["id", "tokenVersion"])], manifest)).toEqual([
			"exemption Log: the reason must be a real sentence (at least 40 characters)",
			"not-secret column User.tokenVersion: the reason must be a real sentence (at least 40 characters)",
		]);
	});

	it("rejects a name that is not a plain identifier (it is interpolated into the trigger)", () => {
		expect(findDataChangeManifestProblems([table("User", ["id", "bad,name"])], EMPTY_MANIFEST)).toEqual([
			'User: "bad,name" is not a plain identifier, so it cannot be passed to the capture trigger',
		]);
	});
});

describe("planDataChangeCapture", () => {
	const manifest: DataChangeCaptureManifest = {
		exemptions: { app_logs: LONG_REASON },
		secretColumns: { User: ["passwordHash"] },
		nonSecretColumns: {},
	};

	it("captures every table except the exempt ones and Prisma's bookkeeping table", () => {
		const plan = planDataChangeCapture(
			[
				table("User", ["id", "email", "fullName", "passwordHash"]),
				table("app_logs", ["id"]),
				table(PRISMA_MIGRATIONS_TABLE, ["id", "checksum"]),
				table("members", ["org_id", "userId"], ["org_id", "userId"]),
			],
			manifest,
		);

		expect(plan).toEqual({
			captured: [
				{ name: "members", primaryKeyColumns: ["org_id", "userId"], secretColumns: [], personalColumns: [], emailColumns: [] },
				{ name: "User", primaryKeyColumns: ["id"], secretColumns: ["passwordHash"], personalColumns: ["fullName"], emailColumns: ["email"] },
			],
			exempt: ["app_logs"],
		});
	});

	it("throws one error listing every problem", () => {
		expect(() => planDataChangeCapture([table("User", ["id", "token"])], EMPTY_MANIFEST)).toThrow(DataChangeCaptureManifestError);
	});

	it("is the manifest the apply script uses by default", () => {
		expect(DATA_CHANGE_CAPTURE_MANIFEST.exemptions[DATA_CHANGE_LOG_TABLE]).toBeDefined();
	});
});

describe("buildDataChangeCaptureSql", () => {
	const sql = buildDataChangeCaptureSql({
		captured: [{ name: "User", primaryKeyColumns: ["id"], secretColumns: ["passwordHash"], personalColumns: ["fullName", "phone"], emailColumns: ["email"] }],
		exempt: ["app_logs"],
	});

	it("passes each captured table's key and column lists to both triggers", () => {
		const argumentsSql = "'id', 'passwordHash', 'fullName,phone', 'email'";

		expect(sql).toContain(
			`CREATE TRIGGER ${DATA_CHANGE_ROW_TRIGGER} AFTER INSERT OR UPDATE OR DELETE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.app_capture_data_change(${argumentsSql});`,
		);
		expect(sql).toContain(
			`CREATE TRIGGER ${DATA_CHANGE_TRUNCATE_TRIGGER} AFTER TRUNCATE ON public."User" FOR EACH STATEMENT EXECUTE FUNCTION public.app_capture_data_change(${argumentsSql});`,
		);
	});

	it("is re-runnable: every trigger is dropped before it is created, and exempt tables lose theirs", () => {
		expect(sql).toContain(`DROP TRIGGER IF EXISTS ${DATA_CHANGE_ROW_TRIGGER} ON public."User";`);
		expect(sql).toContain(`DROP TRIGGER IF EXISTS ${DATA_CHANGE_ROW_TRIGGER} ON public."app_logs";`);
		expect(sql).toContain(`DROP TRIGGER IF EXISTS ${DATA_CHANGE_TRUNCATE_TRIGGER} ON public."app_logs";`);
		expect(sql).not.toContain('ON public."app_logs" FOR EACH');
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.app_capture_data_change()");
	});

	it("applies the SAME redaction, masking and size cap as the HTTP audit trail", () => {
		expect(sql).toContain(`to_jsonb('${REDACTED}'::text)`);
		expect(sql).toContain(`to_jsonb('${PII_MASK}'::text)`);
		expect(sql).toContain(`octet_length(entry.value::text) > ${String(AUDIT_PAYLOAD_MAX_BYTES)}`);
	});

	it("records the writer's own role (SECURITY INVOKER) and reads every attribution from the session", () => {
		expect(sql).toContain("SECURITY INVOKER");
		for (const setting of [
			"app.current_user_id",
			"app.current_organization_id",
			"app.current_api_key_id",
			"app.system_operation",
			"app.actor_purpose",
			"app.correlation_id",
			"application_name",
		]) {
			expect(sql).toContain(`current_setting('${setting}', true)`);
		}
	});
});
