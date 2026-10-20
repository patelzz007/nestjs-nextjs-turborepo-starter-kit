import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { TypedConfigService } from "../src/config/typed-config.service";
import { LoginVerificationStore } from "../src/contexts/identity/infrastructure/adapters/login-verification.store";
import { CryptoService } from "../src/contexts/identity/infrastructure/security/crypto.service";
import { createE2eApp, mutationHeaders, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * Concurrent writes on credential state, against the real database and Redis:
 * D12 — two resets presenting one reset link: exactly one wins (compare-and-set on `usedAt IS NULL`);
 * D20 — parallel wrong codes on one new-device verification are each counted (atomic `INCR`), in Redis
 * and in the single-instance memory fallback.
 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;
const PASSWORD = "Concurrent-writes-1A!";
const PARALLEL_ATTEMPTS = 20;
const ATTEMPT_WINDOW_MS = 60_000;

describe("Concurrent credential writes (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		app = await createE2eApp();
	});

	afterAll(async () => {
		await app.close();
	});

	function post(path: string, payload: object): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${API_VERSION_PREFIX}/auth/${path}`, headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }), payload });
	}

	it("D12: of two resets with one link, exactly one succeeds", async () => {
		const email = `concurrent-reset-${randomUUID()}@example.com`;
		const signup = await post("signup", { email, password: PASSWORD, fullName: "Concurrent Reset E2E" });
		expect(signup.statusCode, signup.body).toBe(HTTP_CREATED);

		const tokens = vi.spyOn(app.get(CryptoService), "generateRandomToken");
		const forgot = await post("forgot-password", { email });
		const rawToken = z.string().parse(tokens.mock.results.at(-1)?.value);
		tokens.mockRestore();
		expect(forgot.statusCode, forgot.body).toBe(HTTP_OK);

		const results = await Promise.all([
			post("reset-password", { token: rawToken, password: "Concurrent-reset-A1!" }),
			post("reset-password", { token: rawToken, password: "Concurrent-reset-B2!" }),
		]);
		const statuses = results.map((response: InjectResponse): number => response.statusCode).sort();
		expect(statuses).toEqual([HTTP_OK, HTTP_UNAUTHORIZED]);

		// The link stays spent: a third try is refused too.
		expect((await post("reset-password", { token: rawToken, password: "Concurrent-reset-C3!" })).statusCode).toBe(HTTP_UNAUTHORIZED);
	});

	it("D20: parallel attempts in Redis are each counted once", async () => {
		const store = app.get(LoginVerificationStore);
		const verificationId = randomUUID();
		const counts = await Promise.all(Array.from({ length: PARALLEL_ATTEMPTS }, () => store.incrementAttempts(verificationId, ATTEMPT_WINDOW_MS)));
		expect([...counts].sort((left, right) => left - right)).toEqual(Array.from({ length: PARALLEL_ATTEMPTS }, (_value, index) => index + 1));
		await store.deleteChallenge(verificationId);
	});

	it("D20: the memory fallback (no Redis) counts parallel attempts the same way", async () => {
		const store = new LoginVerificationStore(app.get(TypedConfigService), null);
		const verificationId = randomUUID();
		const counts = await Promise.all(Array.from({ length: PARALLEL_ATTEMPTS }, () => store.incrementAttempts(verificationId, ATTEMPT_WINDOW_MS)));
		expect([...counts].sort((left, right) => left - right)).toEqual(Array.from({ length: PARALLEL_ATTEMPTS }, (_value, index) => index + 1));
	});
});
