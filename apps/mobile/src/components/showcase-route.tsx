// A showcase route (src/app/(app)/showcase): its screen comes from the
// showcase module, which only a build that carries the showcase contains
// (lib/env.ts `loadBundledShowcase`): it is loaded the first time the route
// opens, behind a skeleton. In a build without it, the route sends the person
// to Settings, the way the drawer never lists it there.

import { SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { Redirect } from "expo-router";
import * as React from "react";

import type { ShowcaseScreens } from "../features/showcase/showcase-screens";
import { isShowcaseBundled, loadBundledShowcase } from "../lib/env";
import { lazyView } from "../lib/lazy-view";
import { ROUTES } from "../runtime/routes";
import { Screen } from "./screen";

function ShowcaseRouteLoading(): React.JSX.Element {
	return (
		<Screen testID="showcase-loading">
			<SkeletonGroup accessibilityLabel="Loading the showcase" className="rounded-card gap-3 bg-card p-4">
				<SkeletonText size="lg" widthClassName="w-1/2" />
				<SkeletonText size="sm" widthClassName="w-5/6" />
			</SkeletonGroup>
		</Screen>
	);
}

/** This build has no showcase: Settings instead. */
function ShowcaseUnavailable(): React.JSX.Element {
	return <Redirect href={ROUTES.settings} />;
}

/** The route's default export: the screen `pick` chooses from the showcase, once it has loaded. */
export function showcaseRoute(pick: (screens: ShowcaseScreens) => React.ComponentType): () => React.JSX.Element {
	const LoadedScreen = lazyView(async (): Promise<React.ComponentType> => {
		const screens = await loadBundledShowcase();
		return screens === null ? ShowcaseUnavailable : pick(screens);
	}, ShowcaseRouteLoading);
	function ShowcaseRoute(): React.JSX.Element {
		// Decided when the screen renders, so the store-build behaviour holds whatever an earlier render loaded.
		return isShowcaseBundled() ? <LoadedScreen /> : <ShowcaseUnavailable />;
	}
	return ShowcaseRoute;
}
