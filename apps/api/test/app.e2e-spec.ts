import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Env defaults are applied in `./setup-env.ts` (vitest setupFiles run before
// test-file imports, so the AppModule graph never sees unset config). This
// spec boots the REAL AppModule and needs a reachable Postgres — see
// `setup-env.ts` for the DATABASE_URL override.
import { AppModule } from "../src/app.module.js";

describe("App (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /health returns the { success, data } envelope with a status", async () => {
		const response = await request(app.getHttpServer()).get("/health").expect(200);

		expect(response.body.success).toBe(true);
		expect(response.body.data).toHaveProperty("status");
	});

	it("GET / is public and returns a welcome message", async () => {
		const response = await request(app.getHttpServer()).get("/").expect(200);

		expect(typeof response.body.data).toBe("string");
	});

	it("POST /auth/login with unknown credentials returns a 401 error envelope", async () => {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.send({ email: "no-such-user@example.com", password: "wrong-password" })
			.expect(401);

		// ResponseInterceptor failure shape: { success: false, error: { message, statusCode }, meta }
		expect(response.body.success).toBe(false);
		expect(response.body.error.statusCode).toBe(401);
	});
});
