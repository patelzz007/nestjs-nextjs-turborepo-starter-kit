"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRoutes, ExposureQueue, type AppLanguage, type BundleApp, type Exposure, type FeatureFlagBundle } from "@workspace/shared";
import * as React from "react";

import { useAuth, useAuthClientType } from "../../features/auth/facade";
import { liveEventsUrl, useLiveQueryInvalidation } from "../../features/live-updates/live-query-invalidation";
import { FeatureFlagsContext, type FeatureFlagsContextValue } from "./feature-flags-context";

/** Without a live stream (signed out, or it dropped), the bundle is fetched again this often (and on focus). */
export const FEATURE_FLAG_REFRESH_MS = 300_000;
/** The whole bundle scope, which the live stream invalidates whatever app or store it was fetched for. */
const BUNDLE_SCOPE: readonly string[] = ["feature-flags", "bundle"];

export interface FeatureFlagsProviderProps {
	readonly app: BundleApp;
	/** The store the person works in (the merchant console's tenant and branch). */
	readonly tenantId?: string | undefined;
	readonly locationId?: string | undefined;
	readonly locale?: AppLanguage | undefined;
	/** The bundle the server rendered with, so a flagged section never shows and then disappears. */
	readonly initialBundle?: FeatureFlagBundle | null | undefined;
	readonly children: React.ReactNode;
}

/** Keeps the bundle fresh while signed in: every frame of the version stream refetches it. */
function LiveFlagVersions(): null {
	const clientType = useAuthClientType();
	const url = React.useMemo((): string => liveEventsUrl(apiRoutes.featureFlags.stream, clientType), [clientType]);
	useLiveQueryInvalidation({ url, queryKey: BUNDLE_SCOPE });
	return null;
}

/**
 * One app's feature flags and dynamic configs (ADR 087): the API's evaluated bundle for the signed-in person (or the
 * device), refreshed by the live stream, on focus, every five minutes and when a scheduled rollout next changes;
 * exposures of what the page renders are sent in batches. Mount once per app, inside `AuthProvider`. Screens read it
 * with the hooks of feature-flags-context.tsx.
 */
export function FeatureFlagsProvider({ app, tenantId, locationId, locale, initialBundle, children }: FeatureFlagsProviderProps): React.JSX.Element {
	const { api, isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const input = React.useMemo(() => ({ app, tenantId, locationId, locale }), [app, tenantId, locationId, locale]);
	const query = api.featureFlags.bundle.useQuery(input, { refetchOnWindowFocus: true, refetchInterval: FEATURE_FLAG_REFRESH_MS });
	// The server's bundle answers until the browser's first fetch does, so nothing flickers on load.
	const bundle = query.data?.data ?? initialBundle ?? null;

	// A scheduled rollout's next step: refetch then, even without a stream frame.
	const nextChangeAt = bundle?.nextChangeAt ?? null;
	React.useEffect(() => {
		if (nextChangeAt === null) {
			return undefined;
		}
		const timer = window.setTimeout(
			(): void => {
				void queryClient.invalidateQueries({ queryKey: BUNDLE_SCOPE });
			},
			Math.max(0, nextChangeAt - Date.now()),
		);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [nextChangeAt, queryClient]);

	const [queue] = React.useState(
		(): ExposureQueue =>
			new ExposureQueue(
				async (exposures): Promise<void> => {
					await api.featureFlags.exposures.mutate({ app, tenantId, locationId, exposures: [...exposures] });
				},
				{
					setTimeout: (callback, delayMs): number => window.setTimeout(callback, delayMs),
					clearTimeout: (handle): void => {
						window.clearTimeout(handle);
					},
				},
			),
	);
	// Another person (or none) from here on: what was seen belongs to the session before.
	const personId = user?.id ?? null;
	React.useEffect(() => {
		queue.reset();
	}, [personId, queue]);
	React.useEffect(
		() => (): void => {
			void queue.flush();
		},
		[queue],
	);

	const value = React.useMemo(
		(): FeatureFlagsContextValue => ({
			bundle,
			note: (exposure: Exposure): void => {
				queue.note(exposure);
			},
		}),
		[bundle, queue],
	);
	return (
		<FeatureFlagsContext.Provider value={value}>
			{isAuthenticated ? <LiveFlagVersions /> : null}
			{children}
		</FeatureFlagsContext.Provider>
	);
}
