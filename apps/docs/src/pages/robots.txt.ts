import type { APIRoute } from "astro";

import { SITE_URL } from "@/lib/site";

export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL("/sitemap-index.xml", site ?? SITE_URL).href;
	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
