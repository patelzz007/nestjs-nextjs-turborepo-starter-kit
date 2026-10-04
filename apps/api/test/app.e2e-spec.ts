import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	ApiVersionManifestSchema,
	HealthResponseSchema,
	LivenessResponseSchema,
	ReadinessResponseSchema,
	StringValueSchema,
	apiContract,
	type RestMethod,
} from "@workspace/shared";
import { z } from "zod";

// Env defaults are applied in `./setup-env.ts` (vitest setupFiles run before
// test-file imports, so the AppModule graph never sees unset config). This
// spec boots the REAL AppModule and needs a reachable Postgres — see
// `setup-env.ts` for the DATABASE_URL override.
import { HealthService } from "../src/modules/health/health.service";
import { createE2eApp, mutationHeaders, parseSuccessEnvelope, uniqueClientIp } from "./e2e-helpers";

// ── Contract-vs-routes drift guard ───────────────────────────────────────
// Every `apiContract` leaf must map to a REGISTERED versioned route. This is
// the machine check that would have caught the `/session` regression: a
// controller that forgets `apiPath()` silently serves an unversioned path the
// client transport can never reach. We inject an UNAUTHENTICATED request per
// leaf — protected routes answer 401 before their handlers run (so a fake id
// never triggers a data-dependent 404), and public routes answer 400/401 on
// the empty/fake input. A 404 means the route simply isn't registered.
interface ContractLeaf {
	readonly method: RestMethod;
	readonly path: string;
}

/** A contract group: nested groups or leaves, keyed by name (the shape of `apiContract`). */
interface ContractNode {
	readonly [key: string]: ContractNode | ContractLeaf;
}

/** Runtime check that a contract entry is a route leaf (method + path) rather than a nested group. */
const ContractLeafSchema = z.object({
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
	path: z.string(),
});

function collectContractLeaves(node: ContractNode, out: ContractLeaf[]): void {
	for (const value of Object.values(node)) {
		const leaf = ContractLeafSchema.safeParse(value);
		if (leaf.success) {
			out.push({ method: leaf.data.method, path: leaf.data.path });
		} else if (!("method" in value)) {
			collectContractLeaves(value, out);
		}
	}
}

/** Fills `:param` segments with stable placeholders so the URL is injectable. */
function fillPathParams(path: string): string {
	return path.replace(/:([A-Za-z0-9_]+)/g, (_match: string, name: string) => `test-${name}`);
}

describe("App (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		app = await createE2eApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /health returns the { success, data } envelope with a status", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		const envelope = parseSuccessEnvelope(response, HealthResponseSchema);
		expect(envelope.success).toBe(true);
		expect(envelope.data).toHaveProperty("status");
	});

	it("GET / is public and returns a welcome message", async () => {
		const response = await app.inject({ method: "GET", url: "/" });

		expect(response.statusCode).toBe(200);
		expect(typeof parseSuccessEnvelope(response, StringValueSchema).data).toBe("string");
	});

	it("GET /api/v1/auth/me without a token returns a 401", async () => {
		const response = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

		expect(response.statusCode).toBe(401);
	});

	it("POST /api/v1/auth/login with unknown credentials returns a 401 error envelope", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { email: "no-such-user@example.com", password: "wrong-password" },
		});

		expect(response.statusCode).toBe(401);
		// GlobalExceptionFilter: { success: false, error: { code, message, details? }, meta } (docs/technical/api/errors.md).
		const envelope = ApiErrorResponseSchema.parse(response.json());
		expect(envelope.error.code).toBe("INVALID_CREDENTIALS");
		expect(envelope.error.message).toContain("Invalid email or password");
		expect(envelope.meta.correlationId.length).toBeGreaterThan(0);
		// One request context (ADR 017): header and envelope carry the same id.
		expect(response.headers["x-correlation-id"]).toBe(envelope.meta.correlationId);
	});

	it("echoes a valid caller correlation id in the header and both envelopes, and replaces an unsafe one", async () => {
		const ok = await app.inject({ method: "GET", url: "/", headers: { "x-correlation-id": "e2e-corr-0001" } });
		expect(ok.headers["x-correlation-id"]).toBe("e2e-corr-0001");
		expect(parseSuccessEnvelope(ok, StringValueSchema).meta.correlationId).toBe("e2e-corr-0001");

		const failed = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { "x-correlation-id": "e2e-corr-0002" } });
		expect(ApiErrorResponseSchema.parse(failed.json()).meta.correlationId).toBe("e2e-corr-0002");

		const unsafe = await app.inject({ method: "GET", url: "/", headers: { "x-correlation-id": "x".repeat(65) } });
		expect(unsafe.headers["x-correlation-id"]).not.toBe("x".repeat(65));
		expect(parseSuccessEnvelope(unsafe, StringValueSchema).meta.correlationId).toBe(unsafe.headers["x-correlation-id"]);
	});

	it("GET /health/live answers without touching dependencies", async () => {
		const response = await app.inject({ method: "GET", url: "/health/live" });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, LivenessResponseSchema).data.status).toBe("ok");
	});

	it("GET /health/ready reports every probe when the instance can serve traffic", async () => {
		const response = await app.inject({ method: "GET", url: "/health/ready" });

		expect(response.statusCode).toBe(200);
		const readiness = parseSuccessEnvelope(response, ReadinessResponseSchema).data;
		expect(readiness.status).toBe("ready");
		expect(readiness.checks).toEqual(expect.arrayContaining([expect.objectContaining({ name: "database", status: "up" })]));
	});

	it("GET /health/ready answers 503 with the error envelope while draining", async () => {
		const health = app.get(HealthService);
		health.markNotReady();
		try {
			const response = await app.inject({ method: "GET", url: "/health/ready" });

			expect(response.statusCode).toBe(503);
			const envelope = ApiErrorResponseSchema.parse(response.json());
			expect(envelope.error.code).toBe("SERVICE_UNAVAILABLE");
			expect(envelope.error.details?.checks).toEqual(expect.arrayContaining([expect.objectContaining({ name: "startup", status: "down" })]));
		} finally {
			health.markReady();
		}
	});

	it("unknown routes answer 404 with the error envelope", async () => {
		const response = await app.inject({ method: "GET", url: "/api/v1/definitely-not-a-route" });

		expect(response.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("NOT_FOUND");
	});

	it("every apiContract leaf maps to a registered versioned route (no 404s)", async () => {
		const leaves: ContractLeaf[] = [];
		collectContractLeaves(apiContract, leaves);
		expect(leaves.length).toBeGreaterThan(0);

		for (const { method, path } of leaves) {
			const url = `${API_VERSION_PREFIX}${fillPathParams(path)}`;
			const response = await app.inject({ method, url });
			expect(response.statusCode, `${method} ${url} must be a registered route (was ${String(response.statusCode)})`).not.toBe(404);
		}
	});

	it("GET /version (unversioned manifest) exposes the current version and prefix", async () => {
		const response = await app.inject({ method: "GET", url: "/version" });

		expect(response.statusCode).toBe(200);
		// RAW body (`@ZodRawResponse`, no envelope): the client transport's 404
		// negotiation (`loadVersionManifest`) parses it with `ApiVersionManifestSchema` directly.
		const body = ApiVersionManifestSchema.parse(response.json());
		expect(body.current).toBe("v1");
		expect(body.prefix).toBe("/api/v1");
		expect(body.docs).toBe("/v1/docs");
		expect(Array.isArray(body.supported)).toBe(true);
	});
});
