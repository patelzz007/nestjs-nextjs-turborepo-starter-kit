import type { Href } from "expo-router";

import { ROUTES } from "../../runtime/routes";

/** The search param that names a feature on a component's screen (`/showcase/button?feature=outline`), the web's `#outline`. */
export const FEATURE_PARAM = "feature";

/** Where the showcase lives in the app: its index, one component's screen and its docs, and one feature on that screen. */
export interface ShowcaseRoutes {
	readonly index: Href;
	readonly component: (slug: string) => Href;
	readonly docs: (slug: string) => Href;
	readonly feature: (slug: string, anchor: string) => Href;
}

export const SHOWCASE_ROUTES: ShowcaseRoutes = {
	index: ROUTES.showcase,
	component: (slug: string): Href => ({ pathname: "/showcase/[slug]", params: { slug } }),
	docs: (slug: string): Href => ({ pathname: "/showcase/[slug]/docs", params: { slug } }),
	feature: (slug: string, anchor: string): Href => ({ pathname: "/showcase/[slug]", params: { slug, [FEATURE_PARAM]: anchor } }),
};
