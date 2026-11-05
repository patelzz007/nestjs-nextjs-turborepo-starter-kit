import { createFileRoute } from "@tanstack/react-router";

import { robotsTxt, SITE_URL } from "../lib/site";

/** The indexing policy: everything may be indexed; the sitemap lists every page. */
export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: (): Response => new Response(robotsTxt(SITE_URL), { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
		},
	},
});
