import { ROUTES } from "@/lib/routes";

/**
 * Where the showcase lives in this app: its index, one component's page, one part of a split page, its docs, and one
 * feature on its page (on its part's page when the component's page is split).
 */
export const SHOWCASE_ROUTES = {
	index: ROUTES.components.index,
	component: ROUTES.components.component,
	part: ROUTES.components.part,
	docs: ROUTES.components.docs,
	feature: (slug: string, anchor: string, part: string | null = null): string =>
		`${part === null ? ROUTES.components.component(slug) : ROUTES.components.part(slug, part)}#${anchor}`,
} satisfies {
	readonly index: string;
	readonly component: (slug: string) => string;
	readonly part: (slug: string, part: string) => string;
	readonly docs: (slug: string) => string;
	readonly feature: (slug: string, anchor: string, part?: string | null) => string;
};
