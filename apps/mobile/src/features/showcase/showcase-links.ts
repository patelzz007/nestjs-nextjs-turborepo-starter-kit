import type { Href } from "expo-router";

import { showcaseItemBySlug } from "./showcase-catalog";
import { SHOWCASE_ROUTES } from "./showcase-routes";

/** A showcase link as the content writes it: `/showcase`, `/showcase/<slug>`, `/showcase/<slug>/docs`, `/showcase/<slug>#<feature>`. */
const SHOWCASE_LINK = /^\/showcase(?:\/(?<slug>[a-z0-9-]+)(?<docs>\/docs)?)?\/?(?:#(?<anchor>[a-z0-9-]+))?$/u;

/** Where a link in the showcase's content goes in the app, or `null` when it is not a showcase link (or names no component). */
export function showcaseHrefOf(href: string): Href | null {
	const groups = SHOWCASE_LINK.exec(href)?.groups;
	if (groups === undefined) {
		return null;
	}
	const { slug, docs, anchor } = groups;
	if (slug === undefined) {
		return SHOWCASE_ROUTES.index;
	}
	if (showcaseItemBySlug(slug) === undefined) {
		return null;
	}
	if (docs !== undefined) {
		return SHOWCASE_ROUTES.docs(slug);
	}
	return anchor === undefined ? SHOWCASE_ROUTES.component(slug) : SHOWCASE_ROUTES.feature(slug, anchor);
}
