// The showcase's three screens as the routes draw them, reading their params:
// the one module lib/env.ts imports (`loadBundledShowcase`) — and only in a
// build that carries the showcase, so nothing else may import it.

import PackageSearchIcon from "lucide-react-native/icons/package-search";
import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { useRouter } from "expo-router";
import * as React from "react";
import { z } from "zod";

import { Screen } from "../../components/screen";
import { useRouteParams } from "../../lib/route-params";
import { showcaseItemBySlug, type ShowcaseCatalogItem } from "./showcase-catalog";
import { ShowcaseComponentScreen } from "./showcase-component-screen";
import { ShowcaseDocsScreen } from "./showcase-docs-screen";
import { ShowcaseIndexScreen } from "./showcase-index-screen";
import { FEATURE_PARAM, SHOWCASE_ROUTES } from "./showcase-routes";

/** `/showcase/<slug>` (and `?feature=<anchor>` on a component screen). */
const ComponentParamsSchema = z.object({ slug: z.string().min(1), [FEATURE_PARAM]: z.string().min(1).optional() });

/** A slug the showcase does not have: the web's 404, with the way back. */
function ShowcaseNotFound(): React.JSX.Element {
	const router = useRouter();
	const openIndex = React.useCallback((): void => {
		router.replace(SHOWCASE_ROUTES.index);
	}, [router]);
	return (
		<Screen testID="showcase-not-found">
			<EmptyState icon={PackageSearchIcon} title="No such component" message="The showcase has no component at this address.">
				<Button label="Browse the showcase" variant="outline" onPress={openIndex} />
			</EmptyState>
		</Screen>
	);
}

/** The catalog item a route's `slug` names, or `null` (with the feature to scroll to). */
function useShowcaseItem(): { readonly item: ShowcaseCatalogItem; readonly feature: string | undefined } | null {
	const params = useRouteParams(ComponentParamsSchema);
	const item = params === null ? undefined : showcaseItemBySlug(params.slug);
	return item === undefined || params === null ? null : { item, feature: params[FEATURE_PARAM] };
}

function ShowcaseComponentRoute(): React.JSX.Element {
	const found = useShowcaseItem();
	if (found === null) {
		return <ShowcaseNotFound />;
	}
	// Keyed by the component: moving to the next one starts its screen afresh (its examples, its scroll).
	return <ShowcaseComponentScreen key={found.item.entry.slug} item={found.item} feature={found.feature} />;
}

function ShowcaseDocsRoute(): React.JSX.Element {
	const found = useShowcaseItem();
	if (found === null) {
		return <ShowcaseNotFound />;
	}
	return <ShowcaseDocsScreen key={found.item.entry.slug} item={found.item} />;
}

/** The screens a build with the showcase draws at `/showcase`, `/showcase/<slug>` and `/showcase/<slug>/docs`. */
export interface ShowcaseScreens {
	readonly index: React.ComponentType;
	readonly component: React.ComponentType;
	readonly docs: React.ComponentType;
}

export const SHOWCASE_SCREENS: ShowcaseScreens = {
	index: ShowcaseIndexScreen,
	component: ShowcaseComponentRoute,
	docs: ShowcaseDocsRoute,
};
