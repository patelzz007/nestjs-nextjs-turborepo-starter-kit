import type { INestApplication } from "@nestjs/common";
import { VersioningType } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Env defaults are applied in `./setup-env.ts` (vitest setupFiles run before
// test-file imports, so the AppModule graph never sees unset config). This
// spec boots the REAL AppModule and needs a reachable Postgres — see
// `setup-env.ts` for the DATABASE_URL override.
import { AppModule } from "../src/app.module";

describe("App (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		// The API runs on the Fastify adapter; rawBody: true matches bootstrap()
		// (the webhook controller reads `req.rawBody`). The global prefix +
		// URI versioning mirror main.ts so route paths behave identically
		// (`/api/v1/…` for everything except the excluded health/webhook routes).
		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
		// `@fastify/cookie` decorates `request.cookies` — AuthGuard / RefreshTokenGuard
		// read it directly, so the harness registers it exactly like main.ts does.
		await app.register(fastifyCookie);
		app.setGlobalPrefix("api", { exclude: ["", "health", "notifications/email-webhook"] });
		app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
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
});
