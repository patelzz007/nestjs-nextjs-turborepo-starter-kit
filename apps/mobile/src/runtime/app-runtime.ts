// ============================================
// app-runtime.ts - everything the app builds once per start (§9.4)
// ============================================
// In order: the environment check (an invalid one stops here: the config error
// screen), the app version, the query client, the session and preferences
// stores, the Secure Store token provider and the API client. Nothing here
// runs at module scope; the root layout calls `createAppRuntime` once.

import { InvalidApiClientConfigError } from "@workspace/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { createMobileApiClient, type MobileApiClient } from "../lib/api";
import { InvalidAppVersionError } from "../lib/app-version";
import { buildDeviceHeaders, type DeviceDetails } from "../lib/device-headers";
import { resolveMobileEnv, type MobileEnv, type RawMobileEnv } from "../lib/env";
import { createMobileQueryClient } from "../lib/query-client";
import { SecureStoreTokenProvider } from "../lib/secure-store-token-provider";
import type { ThemePreference } from "../lib/secure-store";
import { forgetEnrollment, isEnrollmentUnchanged } from "../features/app-lock/app-lock-enrollment";
import { preferencesActions } from "../features/preferences/actions";
import type { PreferencesState } from "../features/preferences/state";
import { createPreferencesStore, type PreferencesStore } from "../features/preferences/store";
import { readSessionScope } from "../features/session/access-token-claims";
import { sessionActions } from "../features/session/actions";
import { restoreSession } from "../features/session/restore-session";
import { selectCanReadRefreshToken } from "../features/session/selectors";
import { createSessionStore, type SessionStore } from "../features/session/store";

/** Why the app cannot start: what is wrong and an example of a right value — never the configured value. */
export interface ConfigIssue {
	readonly subject: string;
	readonly message: string;
	readonly example: string;
}

export interface ReadyAppRuntime {
	readonly kind: "ready";
	readonly env: MobileEnv;
	readonly appName: string;
	readonly appVersion: string;
	readonly buildNumber: string | null;
	readonly queryClient: QueryClient;
	readonly sessionStore: SessionStore;
	readonly preferencesStore: PreferencesStore;
	readonly tokenProvider: SecureStoreTokenProvider;
	readonly apiClient: MobileApiClient;
	/** Turns the app lock off and drops the session (biometrics changed, §11.2). */
	readonly resetAppLock: () => Promise<void>;
}

export type AppRuntime = { readonly kind: "configError"; readonly issue: ConfigIssue } | ReadyAppRuntime;

/** What the runtime reads from the device and the build (injected, so tests pass their own). */
export interface AppRuntimeInputs {
	readonly rawEnv: RawMobileEnv;
	readonly appName: string;
	readonly readAppVersion: () => string;
	readonly buildNumber: string | null;
	readonly deviceDetails: DeviceDetails;
	readonly applyTheme: (theme: ThemePreference) => void;
	readonly savePreferences: (preferences: PreferencesState) => Promise<void>;
	/** A non-fatal problem worth a developer's attention (a preference that could not be saved). */
	readonly reportWarning: (message: string, error: Error) => void;
}

const APP_VERSION_EXAMPLE = "1.0.0 (app.config.ts → version)";

export function createAppRuntime(inputs: AppRuntimeInputs): AppRuntime {
	const envResult = resolveMobileEnv(inputs.rawEnv);
	if (!envResult.ok) {
		const { variable, message, example } = envResult.issue;
		return { kind: "configError", issue: { subject: variable, message, example } };
	}

	let appVersion: string;
	try {
		appVersion = inputs.readAppVersion();
	} catch (error) {
		if (error instanceof InvalidAppVersionError) {
			return { kind: "configError", issue: { subject: "App version", message: error.message, example: APP_VERSION_EXAMPLE } };
		}
		throw error;
	}

	// The stores and the query client refer to each other only through these closures.
	const queryClient: QueryClient = createMobileQueryClient({
		onUpgradeRequired: (minimumVersion: string | null): void => {
			sessionStore.dispatch(sessionActions.upgradeRequired(minimumVersion));
		},
	});
	const sessionStore: SessionStore = createSessionStore({
		clearServerState: (): void => {
			queryClient.clear();
		},
	});
	const preferencesStore = createPreferencesStore({
		applyTheme: inputs.applyTheme,
		save: inputs.savePreferences,
		onSaveFailed: (error: Error): void => {
			inputs.reportWarning("A preference could not be saved; it applies until the app restarts.", error);
		},
	});
	const tokenProvider = new SecureStoreTokenProvider({
		canReadRefreshToken: (): boolean => selectCanReadRefreshToken(sessionStore.getState()),
		onTokensSaved: (accessToken: string): void => {
			const session = readSessionScope(accessToken);
			if (session !== null) {
				sessionStore.dispatch(sessionActions.tokensRotated(session));
			}
		},
	});

	let apiClient: MobileApiClient;
	try {
		apiClient = createMobileApiClient({
			baseUrl: envResult.env.apiBaseUrl,
			appVersion,
			deviceHeaders: buildDeviceHeaders(inputs.deviceDetails),
			tokenProvider,
			onSessionExpired: (): void => {
				sessionStore.dispatch(sessionActions.expired());
			},
		});
	} catch (error) {
		if (error instanceof InvalidApiClientConfigError) {
			return { kind: "configError", issue: { subject: "API client", message: error.message, example: "EXPO_PUBLIC_API_URL=https://api.example.com" } };
		}
		throw error;
	}

	const resetAppLock = async (): Promise<void> => {
		preferencesStore.dispatch(preferencesActions.appLockTurnedOff());
		await forgetEnrollment();
		await tokenProvider.clearTokens();
	};

	return {
		kind: "ready",
		env: envResult.env,
		appName: inputs.appName,
		appVersion,
		buildNumber: inputs.buildNumber,
		queryClient,
		sessionStore,
		preferencesStore,
		tokenProvider,
		apiClient,
		resetAppLock,
	};
}

/**
 * The start sequence (§9.4): preferences first (the theme is applied before the
 * first frame — the navigator is not rendered until the session is restored),
 * then the session.
 */
export async function startAppRuntime(runtime: ReadyAppRuntime, loadPreferences: () => Promise<PreferencesState>): Promise<void> {
	const preferences = await loadPreferences();
	runtime.preferencesStore.dispatch(preferencesActions.restored(preferences));
	const restored = await restoreSession({
		readAccessToken: (): Promise<string | null> => runtime.tokenProvider.getAccessToken(),
		appLockEnabled: preferences.appLock.enabled,
		isEnrollmentUnchanged,
		resetAppLock: runtime.resetAppLock,
		clearTokens: (): Promise<void> => runtime.tokenProvider.clearTokens(),
	});
	runtime.sessionStore.dispatch(sessionActions.restored(restored));
}
