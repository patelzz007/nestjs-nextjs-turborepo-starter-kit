import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, LoginVerificationPendingResponseSchema } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { HealthService } from "../src/modules/health/health.service";
import { CryptoService } from "../src/modules/auth/services/crypto.service";
import { extractCookie, mutationHeaders, parseSuccessEnvelope, uniqueClientIp } from "./e2e-helpers";

/**
 * The rest of the e2e suite runs with `LOGIN_VERIFICATION_MODE=disabled` (no
 * inbox). This suite boots the API with verification ON — as production runs —
 * and proves a password alone does not create a session: the emailed code is
 * required, and a wrong code is rejected.
 */

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";

describe("Login verification ON (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const base = getApiConfig();
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(TypedConfigService)
			.useValue(new TypedConfigService({ ...base, auth: { ...base.auth, loginVerificationMode: "always" } }))
			.compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
		await app.register(fastifyCookie);
		await app.init();
		app.get(HealthService).markReady();
	});

	afterAll(async () => {
		await app.close();
	});

	it("requires the emailed code before issuing a session, and rejects a wrong one", async () => {
		const codes = vi.spyOn(app.get(CryptoService), "generateNumericCode");
		const loginResponse = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp(), "user-agent": "login-verification-e2e" }),
			payload: { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD },
		});
		const code = z.string().length(6).parse(codes.mock.results.at(-1)?.value);
		codes.mockRestore();

		expect(loginResponse.statusCode, loginResponse.body).toBe(201);
		expect(extractCookie(loginResponse.headers["set-cookie"], "accessToken")).toBeUndefined();
		const pending = parseSuccessEnvelope(loginResponse, LoginVerificationPendingResponseSchema).data;

		const wrong = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/verify-login`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { verificationId: pending.verificationId, code: code === "000000" ? "111111" : "000000" },
		});
		expect(wrong.statusCode).toBe(401);
		expect(extractCookie(wrong.headers["set-cookie"], "accessToken")).toBeUndefined();

		const verified = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/verify-login`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { verificationId: pending.verificationId, code },
		});
		expect(verified.statusCode, verified.body).toBe(200);
		expect(extractCookie(verified.headers["set-cookie"], "accessToken")).toBeDefined();
	});
});
