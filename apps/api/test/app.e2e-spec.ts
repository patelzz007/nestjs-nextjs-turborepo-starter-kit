import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, apiContract, type RestMethod } from "@workspace/shared";

// Env defaults are applied in `./setup-env.ts` (vitest setupFiles run before
// test-file imports, so the AppModule graph never sees unset config). This
// spec boots the REAL AppModule and needs a reachable Postgres — see
// `setup-env.ts` for the DATABASE_URL override.
import { AppModule } from "../src/app.module";

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

function collectContractLeaves(node: unknown, out: ContractLeaf[]): void {
	if (node === null || typeof node !== "object") return;
	if ("method" in node && "path" in node && typeof node.method === "string" && typeof node.path === "string") {
		const method: string = node.method as string;
		if (method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
			out.push({ method, path: node.path as string });
		}
		return;
	}
	for (const value of Object.values(node)) {
		if (typeof value === "object" && value !== null) collectContractLeaves(value, out);
	}
}

/** Fills `:param` segments with stable placeholders so the URL is injectable. */
function fillPathParams(path: string): string {
	return path.replace(/:([A-Za-z0-9_]+)/g, (_match: string, name: string) => `test-${name}`);
}

describe("App (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		// The API runs on the Fastify adapter; rawBody: true matches bootstrap()
		// (the webhook controller reads `req.rawBody`). Versioning is explicit:
		// business controllers build their paths with `apiPath()` from
		// `@workspace/shared` (→ `/api/v1/…`), and health/webhook stay
		// unversioned — mirroring main.ts exactly. `@fastify/cookie` decorates
		// `request.cookies` (AuthGuard reads it directly), registered like main.ts.
		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
		await app.register(fastifyCookie);
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /health returns the { success, data } envelope with a status", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
		expect(response.json().data).toHaveProperty("status");
	});

	it("GET / is public and returns a welcome message", async () => {
		const response = await app.inject({ method: "GET", url: "/" });

		expect(response.statusCode).toBe(200);
		expect(typeof response.json().data).toBe("string");
	});

	it("GET /api/v1/auth/me without a token returns a 401", async () => {
		const response = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

		expect(response.statusCode).toBe(401);
	});

	it("POST /api/v1/auth/login with unknown credentials returns a 401 error envelope", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "no-such-user@example.com", password: "wrong-password" },
		});

		expect(response.statusCode).toBe(401);
		// Nest's exception layer error shape: { message, error } (the
		// `{ success: false, ... }` envelope only exists in Swagger DTOs — the
		// ResponseInterceptor wraps successes and records failures internally).
		expect(response.json().error).toBe("INVALID_CREDENTIALS");
		expect(response.json().message).toContain("Invalid email or password");
	});

	it("every apiContract leaf maps to a registered versioned route (no 404s)", async () => {
		const leaves: ContractLeaf[] = [];
		collectContractLeaves(apiContract, leaves);
		expect(leaves.length).toBeGreaterThan(0);

		for (const { method, path } of leaves) {
			const url: string = `${API_VERSION_PREFIX}${fillPathParams(path)}`;
			const response = await app.inject({ method, url });
			expect(response.statusCode, `${method} ${url} must be a registered route (was ${String(response.statusCode)})`).not.toBe(404);
		}
	});

	it("GET /version (unversioned manifest) exposes the current version and prefix", async () => {
		const response = await app.inject({ method: "GET", url: "/version" });

		expect(response.statusCode).toBe(200);
		// The ResponseInterceptor wraps the manifest in the standard envelope.
		const body = response.json().data;
		expect(body.current).toBe("v1");
		expect(body.prefix).toBe("/api/v1");
		expect(body.docs).toBe("/v1/docs");
		expect(Array.isArray(body.supported)).toBe(true);
	});
});
