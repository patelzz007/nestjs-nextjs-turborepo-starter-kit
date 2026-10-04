import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, JsonValueSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * The global HTTP audit trail against the real AppModule and database: every
 * POST/PUT/PATCH/DELETE — successful, rejected by a guard, failed validation,
 * failed login — gets exactly one complete, redacted `audit_logs` row; reads
 * get none; the table is append-only for the application role.
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

	it("does not audit reads", async () => {
		const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/geo/stats`, headers: { cookie: cookie(superAdmin) } });
		expect(response.statusCode).toBe(200);

		expect(await auditRowsFor(response)).toEqual([]);
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
