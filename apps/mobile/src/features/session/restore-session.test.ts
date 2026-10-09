import { testAccessToken } from "../../../test/jwt";
import { restoreSession, type RestoreSessionDependencies } from "./restore-session";

function dependencies(overrides: Partial<RestoreSessionDependencies> = {}): RestoreSessionDependencies {
	return {
		readAccessToken: jest.fn((): Promise<string | null> => Promise.resolve(testAccessToken())),
		appLockEnabled: false,
		isEnrollmentUnchanged: jest.fn((): Promise<boolean> => Promise.resolve(true)),
		resetAppLock: jest.fn((): Promise<void> => Promise.resolve()),
		clearTokens: jest.fn((): Promise<void> => Promise.resolve()),
		...overrides,
	};
}

describe("restoreSession", () => {
	it("is signed out without tokens", async () => {
		await expect(restoreSession(dependencies({ readAccessToken: (): Promise<string | null> => Promise.resolve(null) }))).resolves.toEqual({
			status: "signedOut",
			reason: "none",
		});
	});

	it("is signed in with tokens and the lock off", async () => {
		await expect(restoreSession(dependencies())).resolves.toEqual({ status: "signedIn", session: { scope: "full" } });
	});

	it("restores a restricted session as restricted", async () => {
		const restricted = testAccessToken({ sessionScope: "restricted" });
		await expect(restoreSession(dependencies({ readAccessToken: (): Promise<string | null> => Promise.resolve(restricted) }))).resolves.toEqual({
			status: "signedIn",
			session: { scope: "restricted", enrollmentReason: "mfa_enrollment" },
		});
	});

	it("is locked with tokens and the lock on", async () => {
		await expect(restoreSession(dependencies({ appLockEnabled: true }))).resolves.toEqual({ status: "locked" });
	});

	it("resets the lock and signs out when the enrolled biometrics changed", async () => {
		const deps = dependencies({ appLockEnabled: true, isEnrollmentUnchanged: (): Promise<boolean> => Promise.resolve(false) });
		await expect(restoreSession(deps)).resolves.toEqual({ status: "signedOut", reason: "appLockReset" });
		expect(deps.resetAppLock).toHaveBeenCalledTimes(1);
	});

	it("drops an unreadable access token", async () => {
		const deps = dependencies({ readAccessToken: (): Promise<string | null> => Promise.resolve("garbage") });
		await expect(restoreSession(deps)).resolves.toEqual({ status: "signedOut", reason: "sessionExpired" });
		expect(deps.clearTokens).toHaveBeenCalledTimes(1);
	});

	it("starts signed out (keeping the tokens) when the store cannot be read", async () => {
		const deps = dependencies({ readAccessToken: (): Promise<string | null> => Promise.reject(new Error("keychain")) });
		await expect(restoreSession(deps)).resolves.toEqual({ status: "signedOut", reason: "none" });
		expect(deps.clearTokens).not.toHaveBeenCalled();
	});

	it("never checks biometrics when the lock is off", async () => {
		const deps = dependencies();
		await restoreSession(deps);
		expect(deps.isEnrollmentUnchanged).not.toHaveBeenCalled();
	});
});
