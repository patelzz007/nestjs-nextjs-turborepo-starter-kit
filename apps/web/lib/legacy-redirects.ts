import { APP_LINKS } from "@workspace/shared";
import type { NextConfig } from "next";

/** One `redirects()` entry, as `next.config.ts` declares it. */
export type ConfigRedirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

/** Where the signed-in area used to live. */
const LEGACY_DASHBOARD_PREFIX = "/rewardhub";

/**
 * Paths this app used to serve, permanently redirected (308) to where the page lives now. The signed-in
 * area moved from `/rewardhub` to `/dashboard`; bookmarks, emailed links and in-app notification links
 * already stored in the database still name the old path, so it keeps working. Query strings pass through.
 */
export const LEGACY_REDIRECTS: readonly ConfigRedirect[] = [
	{ source: `${LEGACY_DASHBOARD_PREFIX}/:path*`, destination: `${APP_LINKS.web.dashboard}/:path*`, permanent: true },
];
