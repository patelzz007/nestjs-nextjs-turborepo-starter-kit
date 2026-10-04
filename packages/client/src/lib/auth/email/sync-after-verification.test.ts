import type { ApiResponseMeta, Envelope, UserResponse } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import type { RefreshResult } from "../../api/api-request";
import { syncSessionAfterEmailVerification, type EmailVerificationSessionApi, type EmailVerificationSessionCommands } from "./sync-after-verification";

interface SessionCommandsFake extends EmailVerificationSessionCommands {
	readonly calls: string[];
}

function sessionCommandsFake(refreshResult: RefreshResult): SessionCommandsFake {
	const calls: string[] = [];
	return {
		calls,
		login: (profile: UserResponse, answeredBy: ApiResponseMeta): void => {
			calls.push(`login:${profile.email}:${answeredBy.correlationId}`);
		},
		refreshSession: (): Promise<RefreshResult> => {
			calls.push("refreshSession");
			return Promise.resolve(refreshResult);
		},
	};
}

function sessionApi(me: () => Promise<Envelope<UserResponse>>): EmailVerificationSessionApi {
	return { auth: { me: { fetchOrThrow: me } } };
}

describe("syncSessionAfterEmailVerification", () => {
	it("rotates the session through the single-flight refresh, then establishes it from the fresh /auth/me answer (with its real meta)", async () => {
		const commands = sessionCommandsFake("ok");
		const api = sessionApi((): Promise<Envelope<UserResponse>> => Promise.resolve(envelopeFixture(userFixture({ email: "ada@example.com" }))));

		await expect(syncSessionAfterEmailVerification(api, commands)).resolves.toBe("synced");

		expect(commands.calls).toEqual(["refreshSession", "login:ada@example.com:corr-fixture"]);
	});

	it("reports no-session for a guest (the refresh found no session) and reads nothing", async () => {
		const commands = sessionCommandsFake("expired");
		const me = vi.fn<() => Promise<Envelope<UserResponse>>>();

		await expect(syncSessionAfterEmailVerification(sessionApi(me), commands)).resolves.toBe("no-session");

		expect(me).not.toHaveBeenCalled();
		expect(commands.calls).toEqual(["refreshSession"]);
	});

	it("reports unavailable — and assumes NOTHING about the session — when the refresh cannot reach the API", async () => {
		const commands = sessionCommandsFake("transient");
		const me = vi.fn<() => Promise<Envelope<UserResponse>>>();

		await expect(syncSessionAfterEmailVerification(sessionApi(me), commands)).resolves.toBe("unavailable");

		expect(me).not.toHaveBeenCalled();
		expect(commands.calls).toEqual(["refreshSession"]);
	});

	it("reports unavailable when the session cannot be re-read after the rotation (no verified flag is applied locally)", async () => {
		const commands = sessionCommandsFake("ok");
		const api = sessionApi((): Promise<Envelope<UserResponse>> => Promise.reject(new Error("offline")));

		await expect(syncSessionAfterEmailVerification(api, commands)).resolves.toBe("unavailable");

		expect(commands.calls).toEqual(["refreshSession"]);
	});
});
