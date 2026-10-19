// ============================================
// Components — the React Native UI kit gallery (development builds only)
// ============================================
// The gallery is a developer tool, so a store build must not contain it. Its
// body (features/component-gallery/component-gallery-screen-body.tsx and every
// demo section) is imported only inside a `__DEV__` conditional: Metro replaces
// `__DEV__` with `false` in a production bundle and drops the branch — and the
// import with it — before it collects dependencies (the rule the demo accounts
// follow, contexts/identity/auth/demo-accounts.ts). `__DEV__` must stay a
// literal here and the import must stay inside the branch. A store build sends
// this route to Settings; the drawer's Developer section is development-only too.

import { SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { Redirect } from "expo-router";
import * as React from "react";

import { Screen } from "../../../components/screen";
import { COMPONENT_GALLERY_COPY } from "../../../features/component-gallery/labels";
import { lazyView } from "../../../lib/lazy-view";
import { ROUTES } from "../../../runtime/routes";

function ComponentGallerySkeleton(): React.JSX.Element {
	return (
		<Screen description={COMPONENT_GALLERY_COPY.description} testID="component-gallery-loading">
			<SkeletonGroup accessibilityLabel={COMPONENT_GALLERY_COPY.loading} className="gap-3 rounded-xl bg-card p-4">
				<SkeletonText size="lg" widthClassName="w-1/2" />
				<SkeletonText size="sm" widthClassName="w-5/6" />
			</SkeletonGroup>
		</Screen>
	);
}

/** The gallery, loaded the first time the screen opens — and present in development bundles only. */
const ComponentGalleryScreenBody: React.ComponentType | null = __DEV__
	? lazyView(
			async (): Promise<React.ComponentType> => (await import("../../../features/component-gallery/component-gallery-screen-body")).ComponentGalleryScreenBody,
			ComponentGallerySkeleton,
		)
	: null;

export default function ComponentsScreen(): React.JSX.Element {
	// The module-level read above is what keeps the gallery out of a store bundle; this one decides the
	// redirect when the screen renders, so the store-build behaviour holds without re-evaluating the module.
	if (!__DEV__ || ComponentGalleryScreenBody === null) {
		return <Redirect href={ROUTES.settings} />;
	}
	return <ComponentGalleryScreenBody />;
}
