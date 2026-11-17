// ============================================
// feature-flags-provider.tsx - the mobile app's feature flags and dynamic configs (ADR 087)
// ============================================
// The API's evaluated bundle for the signed-in person (or this installation,
// signed out), read with the typed client (TanStack Query), refreshed by the live
// version stream while signed in and in the foreground, when the app comes back,
// every five minutes and when a scheduled rollout next changes. The last bundle
// is kept on the device, so a start without a connection shows what the API last
// said. Reading a bundle and batching exposures are the same code the web apps
// use (@workspace/shared); only the wiring to React Native lives here.

import { useQueryClient } from "@tanstack/react-query";
import {
	apiRoutes,
	configExposure,
	configResultOf,
	configValueOf,
	epochMs,
	ExposureQueue,
	flagExposure,
	flagResultOf,
	isFlagOn,
	type DynamicConfigKey,
	type DynamicConfigValues,
	type Exposure,
	type FeatureFlagBundle,
	type FeatureFlagBundleQuery,
	type FeatureFlagKey,
} from "@workspace/shared";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { openApiEventStream } from "../../lib/api-event-stream";
import type { ServerEvent } from "../../lib/server-events";
import { useAppActive } from "../../lib/use-app-active";
import { useAppLanguage } from "../../features/language/use-app-language";
import { useRootRoute } from "../../features/session/facade";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { readCachedBundle, writeCachedBundle, type BundleStorage } from "./cached-bundle";

/** Without a live stream (signed out, in the background, or it dropped), the bundle is read again this often. */
export const FEATURE_FLAG_REFRESH_MS = 300_000;
/** The whole bundle scope, which the live stream invalidates whatever it was fetched for. */
const BUNDLE_SCOPE: readonly string[] = ["feature-flags", "bundle"];

interface FeatureFlagsContextValue {
	readonly bundle: FeatureFlagBundle | null;
	readonly note: (exposure: Exposure) => void;
}

const FeatureFlagsContext = React.createContext<FeatureFlagsContextValue | null>(null);
FeatureFlagsContext.displayName = "FeatureFlagsContext";

export interface FeatureFlagsProviderProps {
	/** Where the last bundle is kept between starts. */
	readonly storage: BundleStorage;
	readonly children: React.ReactNode;
}

/** Refetches the bundle on every frame of the version stream, while signed in and in the foreground. */
function useLiveFlagVersions(enabled: boolean): void {
	const api = useApi();
	const runtime = useReadyRuntime();
	const queryClient = useQueryClient();
	React.useEffect((): (() => void) | undefined => {
		if (!enabled) {
			return undefined;
		}
		const stream = openApiEventStream({
			runtime,
			api,
			path: apiRoutes.featureFlags.stream,
			onEvent: (event: ServerEvent): void => {
				// A version frame, or a resync after a gap: either way the bundle is read again (it carries no rules).
				if (event.type === "message" || event.type === "resync") {
					void queryClient.invalidateQueries({ queryKey: BUNDLE_SCOPE });
				}
			},
			onState: (): void => {
				// The bundle is read on its own schedule too; the stream's state isn't shown.
			},
		});
		return (): void => {
			stream.close();
		};
	}, [api, enabled, queryClient, runtime]);
}

/** Mount once, inside the API client, query client and session providers. */
export function FeatureFlagsProvider({ storage, children }: FeatureFlagsProviderProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const route = useRootRoute();
	const active = useAppActive();
	const locale = useAppLanguage();
	// Until the session is restored a request would go out without its token: the bundle waits for it.
	const ready = route !== "starting" && route !== "config-error";
	const signedIn = route === "app";
	const input = React.useMemo((): FeatureFlagBundleQuery => ({ app: "mobile", locale }), [locale]);
	const query = api.featureFlags.bundle.useQuery(input, { enabled: ready, refetchInterval: FEATURE_FLAG_REFRESH_MS });
	const fetched = query.data?.data ?? null;

	const [cached, setCached] = React.useState<FeatureFlagBundle | null>(null);
	React.useEffect((): void => {
		void readCachedBundle(storage).then(setCached);
	}, [storage]);
	React.useEffect((): void => {
		if (fetched !== null) {
			void writeCachedBundle(storage, fetched);
		}
	}, [fetched, storage]);
	const bundle = fetched ?? cached;

	useLiveFlagVersions(signedIn && active);

	// Coming back to the foreground: read it again (the stream was closed while away).
	React.useEffect((): void => {
		if (active && ready) {
			void queryClient.invalidateQueries({ queryKey: BUNDLE_SCOPE });
		}
	}, [active, queryClient, ready]);

	// A scheduled rollout's next step: read it again then, even without a stream frame.
	const nextChangeAt = bundle?.nextChangeAt ?? null;
	React.useEffect((): (() => void) | undefined => {
		if (nextChangeAt === null) {
			return undefined;
		}
		const timer = setTimeout(
			(): void => {
				void queryClient.invalidateQueries({ queryKey: BUNDLE_SCOPE });
			},
			Math.max(0, nextChangeAt - Date.now()),
		);
		return (): void => {
			clearTimeout(timer);
		};
	}, [nextChangeAt, queryClient]);

	const [queue] = React.useState(
		(): ExposureQueue =>
			new ExposureQueue(
				async (exposures): Promise<void> => {
					await api.featureFlags.exposures.mutate({ app: "mobile", exposures: [...exposures] });
				},
				{
					setTimeout: (callback, delayMs): number => setTimeout(callback, delayMs),
					clearTimeout: (handle): void => {
						clearTimeout(handle);
					},
				},
			),
	);
	// Signed in or out, the person may have changed: what was seen belongs to the session before.
	React.useEffect((): void => {
		queue.reset();
	}, [queue, signedIn]);
	// Going to the background sends what is waiting (the app may not come back).
	React.useEffect((): void => {
		if (!active) {
			void queue.flush();
		}
	}, [active, queue]);

	const value = React.useMemo(
		(): FeatureFlagsContextValue => ({
			bundle,
			note: (exposure: Exposure): void => {
				queue.note(exposure);
			},
		}),
		[bundle, queue],
	);
	return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export interface StaticFeatureFlagsProviderProps {
	/** The fixed answers; null reads every flag and config as its code default. */
	readonly bundle: FeatureFlagBundle | null;
	readonly onExposure?: ((exposure: Exposure) => void) | undefined;
	readonly children: React.ReactNode;
}

function ignoreExposure(): void {
	// A fixed bundle reports to no one unless asked to.
}

/** Feature flags from a fixed bundle, with no API: for tests of screens that read flags. */
export function StaticFeatureFlagsProvider({ bundle, onExposure = ignoreExposure, children }: StaticFeatureFlagsProviderProps): React.JSX.Element {
	const value = React.useMemo((): FeatureFlagsContextValue => ({ bundle, note: onExposure }), [bundle, onExposure]);
	return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

function useFlagsContext(): FeatureFlagsContextValue {
	const context = React.useContext(FeatureFlagsContext);
	if (context === null) {
		throw new Error("Feature flags are read inside FeatureFlagsProvider");
	}
	return context;
}

/** Whether a feature flag is on for this person (or device); showing it records an exposure. The code default until loaded. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
	const { bundle, note } = useFlagsContext();
	const result = flagResultOf(bundle, key);
	React.useEffect((): void => {
		if (result !== null) {
			note(flagExposure(result, epochMs(Date.now())));
		}
	}, [note, result]);
	return isFlagOn(bundle, key);
}

/** Which of `keys` are on: for the tab bar and the drawer, whose entries may each carry a flag. */
export function useEnabledFeatureFlags(keys: readonly FeatureFlagKey[]): readonly FeatureFlagKey[] {
	const { bundle, note } = useFlagsContext();
	const results = React.useMemo(() => keys.map((key) => flagResultOf(bundle, key)).filter((result) => result !== null), [bundle, keys]);
	React.useEffect((): void => {
		const at = epochMs(Date.now());
		for (const result of results) {
			note(flagExposure(result, at));
		}
	}, [note, results]);
	return React.useMemo(() => keys.filter((key) => isFlagOn(bundle, key)), [bundle, keys]);
}

/** A dynamic config's value, checked against its declared shape; showing it records an exposure. */
export function useDynamicConfig<K extends DynamicConfigKey>(key: K): DynamicConfigValues[K] {
	const { bundle, note } = useFlagsContext();
	const result = configResultOf(bundle, key);
	React.useEffect((): void => {
		if (result !== null) {
			note(configExposure(result, epochMs(Date.now())));
		}
	}, [note, result]);
	return configValueOf(bundle, key);
}

export interface FeatureFlagGateProps {
	readonly flag: FeatureFlagKey;
	/** Shown while the flag is off (nothing by default). */
	readonly fallback?: React.ReactNode;
	readonly children: React.ReactNode;
}

/** Renders `children` only while `flag` is on. */
export function FeatureFlagGate({ flag, fallback = null, children }: FeatureFlagGateProps): React.JSX.Element {
	return <>{useFeatureFlag(flag) ? children : fallback}</>;
}
