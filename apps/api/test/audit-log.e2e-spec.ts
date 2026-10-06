import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, apiRoutes, HttpAuditLogDetailSchema, HttpAuditLogSummarySchema, JsonValueSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * The global HTTP audit trail against the real AppModule and database: every
 * POST/PUT/PATCH/DELETE — successful, rejected by a guard, failed validation,
 * failed login — gets exactly one complete, redacted `audit_logs` row; reads
 * get none; the table is append-only for the application role. The admin
 * viewer (`GET /admin/audit-logs`) shows those rows only to admin-panel
 * sessions holding AUDIT_LOG, and records every viewing as a sensitive read.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const USER_AGENT = "audit-e2e/1.0";

const AuditRowSchema = z.object({
	method: z.string(),
	endpoint: z.string(),
	outcome: z.enum(["SUCCEEDED", "FAILED"]),
	responseStatus: z.number(),
	errorCode: z.string().nullable(),
	actorUserId: z.string().nullable(),
	ipAddress: z.string().nullable(),
	userAgent: z.string().nullable(),
	occurredAt: z.string(),
	completedAt: z.string(),
	requestBody: JsonValueSchema.nullable(),
	responseBody: JsonValueSchema.nullable(),
	systemOperations: z.array(z.string()),
});
type AuditRow = z.output<typeof AuditRowSchema>;

const RequestMetadataRowSchema = z.object({
	traceId: z.string().nullable(),
	authMethod: z.string().nullable(),
	clientType: z.string().nullable(),
	httpVersion: z.string().nullable(),
	host: z.string().nullable(),
	origin: z.string().nullable(),
	referer: z.string().nullable(),
	acceptLanguage: z.string().nullable(),
	requestContentType: z.string().nullable(),
	requestBytes: z.number().nullable(),
	idempotencyKey: z.string().nullable(),
});

const AuditListEnvelopeSchema = z.object({ data: z.array(HttpAuditLogSummarySchema), meta: z.object({ total: z.number() }).loose() });
const AuditDetailEnvelopeSchema = z.object({ data: HttpAuditLogDetailSchema });

const AUDIT_LOGS_URL = `${API_VERSION_PREFIX}${apiRoutes.auditLogs.list}`;

describe("Global HTTP audit trail (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let admin: LoginResult;

	async function auditRowsFor(response: InjectResponse): Promise<AuditRow[]> {
		const correlationId = z.string().parse(response.headers["x-correlation-id"]);
		const result = await pool.query(
			`SELECT method, endpoint, outcome::text AS outcome, response_status AS "responseStatus", error_code AS "errorCode",
			        actor_user_id AS "actorUserId", ip_address AS "ipAddress", user_agent AS "userAgent",
			        occurred_at::text AS "occurredAt", completed_at::text AS "completedAt",
			        request_body AS "requestBody", response_body AS "responseBody", system_operations AS "systemOperations"
			 FROM public.audit_logs WHERE correlation_id = $1`,
			[correlationId],
		);
		return z.array(AuditRowSchema).parse(result.rows);
	}

	async function userId(email: string): Promise<string> {
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [email]);
		return z.string().parse(result.rows.at(0)?.id);
	}

	function cookie(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		admin = await login(app, "admin@example.com", "Admin@123");
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.regions WHERE name LIKE 'audit-e2e-%'");
		await pool.end();
		await app.close();
	});

	it("records a successful write with actor, endpoint, status, timing, device and the bypasses it ran", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(superAdmin), "user-agent": USER_AGENT }),
			payload: { name: `audit-e2e-${randomUUID().slice(0, 8)}` },
		});
		expect(response.statusCode, response.body).toBe(201);

		const rows = await auditRowsFor(response);
		expect(rows).toHaveLength(1);
		const [row] = rows;
		expect(row).toMatchObject({
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}/geo/regions`,
			outcome: "SUCCEEDED",
			responseStatus: 201,
			errorCode: null,
			actorUserId: await userId("superadmin@example.com"),
			userAgent: USER_AGENT,
		});
		expect(row?.ipAddress).not.toBeNull();
		expect(Number(row?.completedAt)).toBeGreaterThanOrEqual(Number(row?.occurredAt));
		expect(row?.systemOperations).toEqual(expect.arrayContaining(["platform.superadmin", "geo.reference_data.write"]));
	});

	it("records a failed login with the password redacted and the email masked", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({ "user-agent": USER_AGENT }),
			payload: { email: "admin@example.com", password: "definitely-wrong-password" },
		});
		expect(response.statusCode).toBe(401);

		const [row] = await auditRowsFor(response);
		expect(row).toMatchObject({ outcome: "FAILED", responseStatus: 401, actorUserId: null });
		expect(row?.requestBody).toEqual({ email: "a***@example.com", password: "[REDACTED]" });
		expect(JSON.stringify(row)).not.toContain("definitely-wrong-password");
	});

	it("records a guard rejection (403) that never reached the handler", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(admin) }),
			payload: { name: "audit-e2e-forbidden" },
		});
		expect(response.statusCode).toBe(403);

		const rows = await auditRowsFor(response);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ outcome: "FAILED", responseStatus: 403, actorUserId: await userId("admin@example.com") });
		expect(rows[0]?.errorCode).not.toBeNull();
	});

	it("records a validation failure", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(superAdmin) }),
			payload: { name: "" },
		});
		expect(response.statusCode).toBe(400);

		const [row] = await auditRowsFor(response);
		expect(row).toMatchObject({ outcome: "FAILED", responseStatus: 400, errorCode: "VALIDATION_ERROR" });
	});

	it("audits reads too — every request, not only state changes", async () => {
		const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/geo/stats`, headers: { cookie: cookie(superAdmin) } });
		expect(response.statusCode).toBe(200);

		const rows = await auditRowsFor(response);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ method: "GET", outcome: "SUCCEEDED", responseStatus: 200, actorUserId: await userId("superadmin@example.com") });
	});

	it("does not audit the automated health probes", async () => {
		const response = await app.inject({ method: "GET", url: "/health/live" });
		expect(response.statusCode).toBe(200);

		expect(await auditRowsFor(response)).toEqual([]);
	});

	it("describes the device the request came from (parsed User-Agent) and its address class", async () => {
		const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
		const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/geo/stats`, headers: { cookie: cookie(superAdmin), "user-agent": iphone } });
		const correlationId = z.string().parse(response.headers["x-correlation-id"]);

		const result = await pool.query(
			`SELECT browser_name AS "browserName", os_name AS "osName", os_version AS "osVersion", device_type::text AS "deviceType", device_model AS "deviceModel",
			        ip_version AS "ipVersion", ip_scope::text AS "ipScope"
			 FROM public.audit_logs WHERE correlation_id = $1`,
			[correlationId],
		);
		expect(result.rows).toEqual([{ browserName: "Safari", osName: "iOS", osVersion: "18.0", deviceType: "MOBILE", deviceModel: "iPhone", ipVersion: 4, ipScope: "LOOPBACK" }]);
	});

	it("records the request metadata: trace id, credential, client, protocol and browser headers", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({
				cookie: cookie(superAdmin),
				referer: "http://localhost:3000/geography?token=leak",
				"accept-language": "en-GB,en;q=0.9",
				"x-client-type": "web",
			}),
			payload: { name: `audit-e2e-${randomUUID().slice(0, 8)}` },
		});
		expect(response.statusCode, response.body).toBe(201);

		const correlationId = z.string().parse(response.headers["x-correlation-id"]);
		const result = await pool.query(
			`SELECT trace_id AS "traceId", auth_method::text AS "authMethod", client_type AS "clientType", http_version AS "httpVersion", host, origin, referer,
			        accept_language AS "acceptLanguage", request_content_type AS "requestContentType", request_bytes AS "requestBytes", idempotency_key AS "idempotencyKey"
			 FROM public.audit_logs WHERE correlation_id = $1`,
			[correlationId],
		);
		const [row] = z.array(RequestMetadataRowSchema).parse(result.rows);
		expect(row).toMatchObject({
			traceId: correlationId,
			authMethod: "SESSION_COOKIE",
			clientType: "web",
			httpVersion: "1.1",
			// mutationHeaders() sends the trusted web origin (the CSRF guard rejects any other).
			origin: "http://localhost:3000",
			referer: "http://localhost:3000/geography?token=[REDACTED]",
			acceptLanguage: "en-GB,en;q=0.9",
			idempotencyKey: null,
		});
		expect(row?.requestContentType).toMatch(/^application\/json/);
		expect(row?.requestBytes).toBeGreaterThan(0);
		expect(row?.host).not.toBeNull();
	});

	it("shows an admin the audit trail — filtered list, then one complete record with names resolved", async () => {
		const regionName = `audit-e2e-${randomUUID().slice(0, 8)}`;
		const write = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(superAdmin) }),
			payload: { name: regionName },
		});
		const correlationId = z.string().parse(write.headers["x-correlation-id"]);

		const list = await app.inject({ method: "GET", url: AUDIT_LOGS_URL, query: { "filter[correlationId][eq]": correlationId }, headers: { cookie: cookie(admin) } });
		expect(list.statusCode, list.body).toBe(200);
		const page = AuditListEnvelopeSchema.parse(list.json());
		expect(page.meta.total).toBe(1);
		const [summary] = page.data;
		expect(summary).toMatchObject({ method: "POST", outcome: "SUCCEEDED", authMethod: "SESSION_COOKIE", actor: { email: "superadmin@example.com" } });
		expect(summary).not.toHaveProperty("requestBody");

		const detail = await app.inject({ method: "GET", url: `${AUDIT_LOGS_URL}/${z.string().parse(summary?.id)}`, headers: { cookie: cookie(admin) } });
		expect(detail.statusCode, detail.body).toBe(200);
		const record = AuditDetailEnvelopeSchema.parse(detail.json()).data;
		expect(record).toMatchObject({ correlationId, traceId: correlationId, requestBody: { name: regionName } });
		expect(record.systemOperations).toEqual(expect.arrayContaining(["geo.reference_data.write"]));
	});

	it("records every viewing of the audit trail as a sensitive read (GET, the read operation, what was released)", async () => {
		const response = await app.inject({ method: "GET", url: AUDIT_LOGS_URL, query: { limit: "5" }, headers: { cookie: cookie(admin), "user-agent": USER_AGENT } });
		expect(response.statusCode, response.body).toBe(200);

		const rows = await auditRowsFor(response);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			method: "GET",
			endpoint: AUDIT_LOGS_URL,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			actorUserId: await userId("admin@example.com"),
			userAgent: USER_AGENT,
			responseBody: { auditLogView: { view: "list", returned: 5 } },
		});
		expect(rows[0]?.systemOperations).toEqual(expect.arrayContaining(["audit.http_request.read"]));
	});

	it("refuses the audit trail to a session without admin-panel access", async () => {
		const customer = await login(app, "user@example.com", "User@123");

		const response = await app.inject({ method: "GET", url: AUDIT_LOGS_URL, headers: { cookie: cookie(customer) } });

		expect(response.statusCode).toBe(403);
	});

	it("answers 404 for an audit record that does not exist", async () => {
		const response = await app.inject({ method: "GET", url: `${AUDIT_LOGS_URL}/${randomUUID()}`, headers: { cookie: cookie(admin) } });

		expect(response.statusCode).toBe(404);
	});

	it("is append-only for the application role", async () => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SET LOCAL ROLE app_runtime");
			await client.query("SELECT set_config('app.rls_bypass', 'true', true), set_config('app.system_operation', 'audit.http_request.record', true)");
			await expect(client.query("UPDATE public.audit_logs SET response_status = 200")).rejects.toThrow(/permission denied/);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});
});
