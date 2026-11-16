import { ROUTES } from "@/lib/routes";

/** Where the showcase lives in this app: its index, one component's page and its docs, and one feature on that page. */
export const SHOWCASE_ROUTES = {
	index: ROUTES.components.index,
	component: ROUTES.components.component,
	docs: ROUTES.components.docs,
	feature: (slug: string, anchor: string): string => `${ROUTES.components.component(slug)}#${anchor}`,
} satisfies {
	readonly index: string;
	readonly component: (slug: string) => string;
	readonly docs: (slug: string) => string;
	readonly feature: (slug: string, anchor: string) => string;
};
