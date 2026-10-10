// Renders screens the way the app does: a real app runtime (stores, query
// client, Secure Store token provider, api-client) behind the real providers,
// inside Expo Router's test router. Only the boundaries are fakes: `fetch`
// (test/api-stub.ts), the native modules (jest.setup.ts) and the theme hook.

import { QueryClientProvider } from "@tanstack/react-query";
import { renderRouter } from "expo-router/testing-library";
import { Slot, Stack } from "expo-router";
import * as React from "react";
import { Text } from "react-native";

import { AppDrawerStoreProvider } from "../src/features/app-drawer/facade";
import { createAppDrawerStore } from "../src/features/app-drawer/store";
import { PreferencesStoreProvider } from "../src/features/preferences/facade";
import type { PreferencesState } from "../src/features/preferences/state";
import { sessionActions, type RestoredSession } from "../src/features/session/actions";
import { SessionStoreProvider } from "../src/features/session/facade";
import { ApiClientProvider } from "../src/lib/api-context";
import type { RawMobileEnv } from "../src/lib/env";
import type { ThemePreference } from "../src/lib/secure-store";
import { createAppRuntime, type AppRuntimeInputs, type ReadyAppRuntime } from "../src/runtime/app-runtime";
import { ReadyRuntimeProvider } from "../src/runtime/runtime-context";

export const TEST_API_URL = "http://api.test";

export const TEST_RAW_ENV: RawMobileEnv = {
	isDevelopment: true,
	hostUri: "192.168.1.5:8081",
	apiUrl: TEST_API_URL,
	apiPort: undefined,
	iosStoreUrl: undefined,
	androidStoreUrl: undefined,
};

export interface TestRuntimeOverrides {
	readonly rawEnv?: RawMobileEnv;
	readonly readAppVersion?: () => string;
	readonly applyTheme?: (theme: ThemePreference) => void;
	readonly savePreferences?: (preferences: PreferencesState) => Promise<void>;
}

export function testRuntimeInputs(overrides: TestRuntimeOverrides = {}): AppRuntimeInputs {
	return {
		rawEnv: overrides.rawEnv ?? TEST_RAW_ENV,
		appName: "Starter",
		readAppVersion: overrides.readAppVersion ?? ((): string => "1.0.0"),
		buildNumber: null,
		deviceDetails: { modelName: "iPhone 15 Pro", deviceName: "Alex’s iPhone" },
		applyTheme: overrides.applyTheme ?? jest.fn(),
		savePreferences: overrides.savePreferences ?? jest.fn((): Promise<void> => Promise.resolve()),
		reportWarning: jest.fn(),
	};
}

/** Thrown when a test asked for a ready runtime and got a configuration error. */
export class UnexpectedConfigErrorRuntime extends Error {}

export function createTestRuntime(overrides: TestRuntimeOverrides = {}, restored: RestoredSession | null = null): ReadyAppRuntime {
	const runtime = createAppRuntime(testRuntimeInputs(overrides));
	if (runtime.kind !== "ready") {
		throw new UnexpectedConfigErrorRuntime(runtime.issue.message);
	}
	if (restored !== null) {
		runtime.sessionStore.dispatch(sessionActions.restored(restored));
	}
	return runtime;
}

export interface AppProvidersProps {
	readonly runtime: ReadyAppRuntime;
	readonly children: React.ReactNode;
}

/** The providers of src/runtime/app-shell.tsx, without the root guard. */
export function AppProviders({ runtime, children }: AppProvidersProps): React.JSX.Element {
	return (
		<ReadyRuntimeProvider runtime={runtime}>
			<ApiClientProvider client={runtime.apiClient}>
				<QueryClientProvider client={runtime.queryClient}>
					<SessionStoreProvider store={runtime.sessionStore}>
						<PreferencesStoreProvider store={runtime.preferencesStore}>
							{/* The (app) layout provides the drawer's store in the app; screens rendered on their own get one here. */}
							<AppDrawerStoreProvider store={createAppDrawerStore()}>{children}</AppDrawerStoreProvider>
						</PreferencesStoreProvider>
					</SessionStoreProvider>
				</QueryClientProvider>
			</ApiClientProvider>
		</ReadyRuntimeProvider>
	);
}

const SCREEN_OPTIONS = { headerShown: false };

/** A group layout that just renders its child route (`(auth)/_layout`, `(app)/_layout` in tests). */
export function SlotLayout(): React.JSX.Element {
	return <Slot />;
}

/** A placeholder route that only shows its name — for the screens a test navigates to. */
export function markerScreen(name: string): () => React.JSX.Element {
	return function MarkerScreen(): React.JSX.Element {
		return <Text>{name}</Text>;
	};
}

/** Where the test router is (read after the render settled). */
export interface RenderedApp {
	readonly pathname: () => string;
	readonly pathnameWithParams: () => string;
}

/**
 * Renders `screens` (Expo Router file names → components) inside the app's
 * providers, starting at `initialUrl`.
 */
/**
 * A route as a test registers it: a screen component, or a whole module
 * (`import * as …`) when the router must also read the module's other exports,
 * such as a layout's stack settings.
 */
export type TestRoute = (() => React.JSX.Element) | { readonly default: () => React.JSX.Element };

export async function renderInApp(runtime: ReadyAppRuntime, screens: Readonly<Record<string, TestRoute>>, initialUrl: string): Promise<RenderedApp> {
	function TestRootLayout(): React.JSX.Element {
		return (
			<AppProviders runtime={runtime}>
				<Stack screenOptions={SCREEN_OPTIONS} />
			</AppProviders>
		);
	}
	// renderRouter returns the (async) render with the router helpers attached to it.
	const view = renderRouter({ _layout: TestRootLayout, ...screens }, { initialUrl });
	await view;
	return { pathname: (): string => view.getPathname(), pathnameWithParams: (): string => view.getPathnameWithParams() };
}
