import { QueryClient } from "@tanstack/react-query";
import type { AuthSessionSource } from "../session/session";
import type { Envelope, SessionPermissionsResponse, UserResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { stubApiMeta, successEnvelope } from "../../api/envelope";
import { syncSessionAfterEmailVerification, type EmailVerificationSessionApi, type EmailVerificationSessionCommands } from "./sync-after-verification";

interface SessionCommandsFake extends EmailVerificationSessionCommands {
	readonly calls: string[];
}

function sessionCommandsFake(): SessionCommandsFake {
	const calls: string[] = [];
	return {
		calls,
		login: (profile: UserResponse, session?: AuthSessionSource | null): void => {
			calls.push(`login:${profile.email}:${session?.sessionScope ?? "none"}`);
		},
		markEmailVerified: (): void => {
			calls.push("markEmailVerified");
		},
		refreshSession: (): Promise<boolean> => {
			calls.push("refreshSession");
			return Promise.resolve(true);
		},
	};
}

function sessionApi(me: () => Promise<Envelope<UserResponse>>, permissions: () => Promise<Envelope<SessionPermissionsResponse>>): EmailVerificationSessionApi {
	return { auth: { me: { fetchOrThrow: me }, permissions: { fetchOrThrow: permissions } } };
}

const queryClient = new QueryClient();

afterEach((): void => {
	queryClient.clear();
});

describe("syncSessionAfterEmailVerification", () => {
	it("rotates the session, then establishes it from the fresh /auth/me + /auth/permissions answers", async () => {
		const commands = sessionCommandsFake();
		const api = sessionApi(
			(): Promise<Envelope<UserResponse>> => Promise.resolve(successEnvelope(userFixture({ email: "ada@example.com" }), stubApiMeta())),
			(): Promise<Envelope<SessionPermissionsResponse>> => Promise.resolve(successEnvelope(sessionPermissionsFixture({ sessionScope: "full" }), stubApiMeta())),
		);

		await syncSessionAfterEmailVerification(api, commands, queryClient);

		expect(commands.calls).toEqual(["refreshSession", "login:ada@example.com:full"]);
	});

	it("applies the known outcome when the session cannot be re-read", async () => {
		const commands = sessionCommandsFake();
		const api = sessionApi(
			(): Promise<Envelope<UserResponse>> => Promise.reject(new Error("offline")),
			(): Promise<Envelope<SessionPermissionsResponse>> => Promise.reject(new Error("offline")),
		);

		await syncSessionAfterEmailVerification(api, commands, queryClient);

		expect(commands.calls).toEqual(["refreshSession", "markEmailVerified"]);
	});

	it("still re-reads the session when the rotation fails (a guest opening the link)", async () => {
		const commands: SessionCommandsFake = { ...sessionCommandsFake(), refreshSession: vi.fn<() => Promise<boolean>>(() => Promise.reject(new Error("no session"))) };
		const me = vi.fn<() => Promise<Envelope<UserResponse>>>(() => Promise.reject(new Error("401")));
		const api = sessionApi(me, (): Promise<Envelope<SessionPermissionsResponse>> => Promise.reject(new Error("401")));

		await syncSessionAfterEmailVerification(api, commands, queryClient);

		expect(me).toHaveBeenCalledTimes(1);
		expect(commands.calls).toEqual(["markEmailVerified"]);
	});
});
