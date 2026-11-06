import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, PublicStatusPageSchema, StatusIncidentListSchema, StatusIncidentSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const WAIT = { timeout: 20_000, interval: 100 };
const DataSchema = z.object({ data: z.looseObject({}) });
const PUBLIC = "/operations/status";
const INCIDENTS = "/admin/operations/status/incidents";

/**
 * Enhancement 4.5: the public status page, fed by the operations monitor and the incidents staff post, over the
 * real API and database. The seed holds a resolved incident from yesterday, one from last quarter and a removed one.
 */
describe("Public status page and its incidents (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let customer: LoginResult;

	function call(method: "GET" | "POST", path: string, session: LoginResult | null, payload?: object): Promise<InjectResponse> {
		const auth = session === null ? {} : { authorization: `Bearer ${session.accessToken}` };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? { ...auth, "x-forwarded-for": uniqueClientIp() } : mutationHeaders({ ...auth, "x-forwarded-for": uniqueClientIp() }),
			...(payload === undefined ? {} : { payload }),
		});
	}

	async function publicPage(): Promise<z.output<typeof PublicStatusPageSchema>> {
		const response = await call("GET", PUBLIC, null);
		expect(response.statusCode).toBe(200);
		return PublicStatusPageSchema.parse(DataSchema.parse(response.json()).data);
	}

	async function openIncident(title: string): Promise<z.output<typeof StatusIncidentSchema>> {
		const response = await call("POST", INCIDENTS, superAdmin, { title, impact: "MAJOR", components: ["api"], message: "Pages are failing to load for some people." });
		expect(response.statusCode).toBe(201);
		return StatusIncidentSchema.parse(DataSchema.parse(response.json()).data);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("answers anyone, with every part, the last week's resolved incidents only, and nobody's name", async () => {
		const response = await call("GET", PUBLIC, null);
		expect(response.headers["cache-control"]).toBe("public, max-age=30");
		const page = await publicPage();
		expect(page.components.map((component) => component.key)).toStrictEqual(["api", "database", "background-jobs"]);
		expect(page.recent.map((incident) => incident.title)).toContain("Emails and notifications delayed");
		expect(page.recent.map((incident) => incident.title)).not.toContain("Sign-in and checkout unavailable");
		expect([...page.open, ...page.recent].map((incident) => incident.title)).not.toContain("Test incident");
		const yesterday = page.recent.find((incident) => incident.title === "Emails and notifications delayed");
		expect(yesterday?.updates.map((entry) => entry.state)).toStrictEqual(["RESOLVED", "IDENTIFIED", "INVESTIGATING"]);
		expect(response.body).not.toMatch(/postedBy|openedBy|Super Admin/u);
	});

	it("shows an incident staff open on the parts it names, through its updates to resolved, then refuses more (audited)", async () => {
		const incident = await openIncident("Website slow to load (e2e)");
		expect(incident).toMatchObject({ state: "INVESTIGATING", impact: "MAJOR", resolvedAt: null });
		expect(incident.openedByName).not.toBeNull();

		const during = await publicPage();
		expect(during.open.map((entry) => entry.id)).toContain(incident.id);
		expect(during.components.find((component) => component.key === "api")?.status).toMatch(/^(PARTIAL_OUTAGE|MAJOR_OUTAGE)$/u);
		expect(during.overall).toMatch(/^(PARTIAL_OUTAGE|MAJOR_OUTAGE)$/u);

		const path = `${INCIDENTS}/${incident.id}/updates`;
		expect((await call("POST", path, superAdmin, { state: "MONITORING", message: "A fix is out; we're watching it." })).statusCode).toBe(201);
		const resolved = await call("POST", path, superAdmin, { state: "RESOLVED", message: "Everything is back to normal." });
		expect(resolved.statusCode).toBe(201);
		expect(StatusIncidentSchema.parse(DataSchema.parse(resolved.json()).data)).toMatchObject({
			state: "RESOLVED",
			updates: [{ state: "RESOLVED" }, { state: "MONITORING" }, { state: "INVESTIGATING" }],
		});

		const late = await call("POST", path, superAdmin, { state: "MONITORING", message: "One more thing to say about it." });
		expect(late.statusCode).toBe(409);
		expect(ApiErrorResponseSchema.parse(late.json()).error.code).toBe("STATUS_INCIDENT_RESOLVED");

		const after = await publicPage();
		expect(after.open.map((entry) => entry.id)).not.toContain(incident.id);
		expect(after.recent.map((entry) => entry.id)).toContain(incident.id);

		const correlationId = z.string().parse(resolved.headers["x-correlation-id"]);
		await vi.waitFor(async () => {
			const rows = (await pool.query(`SELECT "requestBody" FROM public."AuditLog" WHERE "correlationId" = $1`, [correlationId])).rows;
			expect(rows).toMatchObject([{ requestBody: { state: "RESOLVED", message: "Everything is back to normal." } }]);
		}, WAIT);
	});

	it("lets only one of two people resolving at the same moment post", async () => {
		const incident = await openIncident("Two people resolving (e2e)");
		const path = `${INCIDENTS}/${incident.id}/updates`;
		const answers = await Promise.all([
			call("POST", path, superAdmin, { state: "RESOLVED", message: "Fixed, says the first person." }),
			call("POST", path, superAdmin, { state: "RESOLVED", message: "Fixed, says the second person." }),
		]);
		expect(answers.map((answer) => answer.statusCode).sort()).toStrictEqual([201, 409]);
		const detail = StatusIncidentSchema.parse(DataSchema.parse((await call("GET", `${INCIDENTS}/${incident.id}`, superAdmin)).json()).data);
		expect(detail.updates.filter((entry) => entry.state === "RESOLVED")).toHaveLength(1);
	});

	it("lists incidents for staff with who posted, and refuses bad input, unknown incidents and customers", async () => {
		const list = StatusIncidentListSchema.parse(DataSchema.parse((await call("GET", INCIDENTS, superAdmin)).json()).data);
		expect(list.incidents.map((incident) => incident.title)).toContain("Sign-in and checkout unavailable");
		expect(list.incidents.map((incident) => incident.title)).not.toContain("Test incident");
		expect(list.incidents.flatMap((incident) => incident.updates).every((entry) => entry.postedByName !== null)).toBe(true);

		expect((await call("POST", INCIDENTS, superAdmin, { title: "x", impact: "MAJOR", components: [], message: "short" })).statusCode).toBe(400);
		expect(
			(await call("POST", INCIDENTS, superAdmin, { title: "Twice listed", impact: "MINOR", components: ["api", "api"], message: "Listed the same part twice." })).statusCode,
		).toBe(400);
		const unknown = await call("GET", `${INCIDENTS}/0190f0e0-0000-7000-8000-00000000ffff`, superAdmin);
		expect(unknown.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(unknown.json()).error.code).toBe("STATUS_INCIDENT_NOT_FOUND");
		expect((await call("GET", INCIDENTS, customer)).statusCode).toBeGreaterThanOrEqual(401);
		expect(
			(await call("POST", INCIDENTS, customer, { title: "Not staff", impact: "MINOR", components: ["api"], message: "Customers can't open incidents." })).statusCode,
		).toBeGreaterThanOrEqual(401);
	});
});
