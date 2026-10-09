import { fail, stubApi } from "../../test/api-stub";
import { createTestRuntime, TEST_RAW_ENV, testRuntimeInputs } from "../../test/app-harness";
import { testAccessToken } from "../../test/jwt";
import { memorySecureStore } from "../../test/secure-store-memory";
import { InvalidAppVersionError } from "../lib/app-version";
import { createAppRuntime, startAppRuntime } from "./app-runtime";
import { DEFAULT_PREFERENCES } from "../features/preferences/state";
import { sessionActions } from "../features/session/actions";

jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
	supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
}));

describe("createAppRuntime", () => {
	it("stops at a configuration error, naming the variable", () => {
		const runtime = createAppRuntime(testRuntimeInputs({ rawEnv: { ...TEST_RAW_ENV, isDevelopment: false, apiUrl: undefined } }));
		expect(runtime).toEqual({
			kind: "configError",
			issue: { subject: "EXPO_PUBLIC_API_URL", message: "is required outside development", example: "https://api.example.com" },
		});
	});

	it("stops at an invalid app version", () => {
		const runtime = createAppRuntime(
			testRuntimeInputs({
				readAppVersion: (): string => {
					throw new InvalidAppVersionError("app.config.ts");
				},
			}),
		);
		expect(runtime).toMatchObject({ kind: "configError", issue: { subject: "App version" } });
	});

	it("rethrows anything that is not a configuration problem", () => {
		expect(() =>
			createAppRuntime(
				testRuntimeInputs({
					readAppVersion: (): string => {
						throw new RangeError("bug");
					},
				}),
			),
		).toThrow(RangeError);
	});

	it("builds the stores, the token provider and the API client", () => {
		const runtime = createTestRuntime();
		expect(runtime).toMatchObject({ kind: "ready", appName: "Starter", appVersion: "1.0.0", env: { apiBaseUrl: "http://api.test" } });
		expect(runtime.sessionStore.getState()).toEqual({ status: "starting" });
	});

	it("ends the session when the api-client reports it expired", async () => {
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		stubApi({
			"GET /auth/me": fail(401, "SESSION_REVOKED", "Signed out"),
		});

		await expect(runtime.apiClient.api.auth.me.fetchOrThrow(undefined)).rejects.toThrow();

		expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "sessionExpired" });
		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
	});

	it("reads the refresh token only while signed in and unlocked", async () => {
		const runtime = createTestRuntime({}, { status: "locked" });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await expect(runtime.tokenProvider.getRefreshToken()).rejects.toThrow();

		runtime.sessionStore.dispatch(sessionActions.unlocked({ scope: "full" }));
		await expect(runtime.tokenProvider.getRefreshToken()).resolves.toBe("refresh-1");
	});

	it("reports rotated tokens' new scope (a finished enrollment becomes a full session)", async () => {
		const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
		runtime.sessionStore.dispatch(sessionActions.signedIn({ scope: "restricted", enrollmentReason: "mfa_enrollment" }));

		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken({ sessionScope: "full" }), refreshToken: "refresh-2" });

		expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
	});

	it("shows the update screen on a 426 from any request", async () => {
		const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
		stubApi({
			"POST /auth/forgot-password": fail(426, "APP_VERSION_UNSUPPORTED", "Update", { minimumVersion: "9.0.0" }),
		});

		await expect(
			runtime.queryClient
				.getMutationCache()
				.build(runtime.queryClient, { mutationFn: () => runtime.apiClient.api.auth.forgotPassword.mutate({ email: "a@example.com" }) })
				.execute(undefined),
		).rejects.toThrow();

		expect(runtime.sessionStore.getState()).toEqual({ status: "upgradeRequired", minimumVersion: "9.0.0" });
	});

	it("resetAppLock turns the lock off, forgets the fingerprint and drops the tokens", async () => {
		const runtime = createTestRuntime();
		runtime.preferencesStore.dispatch({ type: "[ Preferences ] App Lock Turned On" });
		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });

		await runtime.resetAppLock();

		expect(runtime.preferencesStore.getState().appLock.enabled).toBe(false);
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBeNull();
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
	});
});

describe("startAppRuntime (§9.4)", () => {
	it("applies the stored theme before restoring the session", async () => {
		const applyTheme = jest.fn();
		const runtime = createTestRuntime({ applyTheme });
		const order: string[] = [];
		applyTheme.mockImplementation((): void => {
			order.push(`theme:${runtime.sessionStore.getState().status}`);
		});

		await startAppRuntime(runtime, () => Promise.resolve({ ...DEFAULT_PREFERENCES, theme: "dark" }));

		expect(order).toEqual(["theme:starting"]);
		expect(applyTheme).toHaveBeenCalledWith("dark");
		expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "none" });
	});

	it("restores a signed-in session, or a locked one when the lock is on", async () => {
		const signedIn = createTestRuntime();
		await signedIn.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await startAppRuntime(signedIn, () => Promise.resolve(DEFAULT_PREFERENCES));
		expect(signedIn.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });

		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		const locked = createTestRuntime();
		memorySecureStore.getItemAsync.mockClear();
		await startAppRuntime(locked, () => Promise.resolve({ ...DEFAULT_PREFERENCES, appLock: { enabled: true, timeoutMs: 60_000 } }));
		expect(locked.sessionStore.getState()).toEqual({ status: "locked" });
		// The refresh token stays unread while the lock is pending (§11.2).
		expect(memorySecureStore.getItemAsync.mock.calls.map(([key]): string => key)).not.toContain("auth.refreshToken");
		expect(locked.preferencesStore.getState().appLock.enabled).toBe(true);
	});
});
