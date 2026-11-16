import { SHOWCASE_API } from "@/components/component-showcase/generated/api";
import { SHOWCASE_CONTENT } from "@/components/component-showcase/generated/content";
import type { ApiEntry } from "@/components/component-showcase/showcase-api";
import type { ShowcaseContent } from "@/components/component-showcase/showcase-content";

/** A component's written content (its overview and docs), or `null` when it has none. */
export function loadShowcaseContent(slug: string): Promise<ShowcaseContent | null> {
	const load = SHOWCASE_CONTENT.get(slug);
	return load === undefined ? Promise.resolve(null) : load();
}

/** A component's generated API reference (empty when it exports nothing documentable). */
export function loadShowcaseApi(slug: string): Promise<readonly ApiEntry[]> {
	const load = SHOWCASE_API.get(slug);
	return load === undefined ? Promise.resolve([]) : load();
}
