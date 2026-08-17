import { redirect } from "next/navigation";

import { source } from "@/lib/source";

/**
 * `/docs` — the guides index has no landing content of its own; the root
 * redirects to the first guide in the sidebar (the old optional catch-all
 * handled the empty-slug case; with the per-page `[slug]` route the redirect
 * lives here instead).
 */
export default function DocsIndexPage(): never {
	const first = source.getPages()[0];
	redirect(first?.url ?? "/");
}
