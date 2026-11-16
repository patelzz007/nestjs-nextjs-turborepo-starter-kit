"use client";

import { NavigationProgressProvider, useNavigationProgress } from "@workspace/ui/components/navigation-progress";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import { useIsClient } from "@workspace/ui/hooks/use-is-client";

/**
 * Completes the top progress bar when the App Router commits a new page: a new path or a
 * new query string. Rendered on the client only (`NavigationProgressSync`), so reading the
 * query string never pushes a statically rendered page into client rendering.
 */
function NavigationProgressRouteWatcher(): null {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { done } = useNavigationProgress();
	const search = searchParams.toString();

	React.useEffect((): void => {
		done();
	}, [pathname, search, done]);

	return null;
}

/**
 * The App Router side of `NavigationProgressProvider`: mount it once inside the provider.
 *
 * The watcher mounts after hydration instead of inside a `<Suspense>` boundary: the server
 * has nothing to render for it, and an empty boundary stayed dehydrated on the client, the
 * shape React DevTools' Suspense tracking throws on ("There should always be an Offscreen
 * Fiber child in a hydrated Suspense boundary"). Nothing is lost: there is no navigation to
 * complete before the app is interactive.
 */
export function NavigationProgressSync(): React.JSX.Element | null {
	const isClient = useIsClient();
	return isClient ? <NavigationProgressRouteWatcher /> : null;
}

/**
 * The top progress bar every Next app mounts once in its root layout, around the page: the
 * kit's bar (link clicks, back/forward, `useProgressRouter`) completed by the App Router.
 */
export function AppNavigationProgress({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<NavigationProgressProvider>
			{children}
			<NavigationProgressSync />
		</NavigationProgressProvider>
	);
}
