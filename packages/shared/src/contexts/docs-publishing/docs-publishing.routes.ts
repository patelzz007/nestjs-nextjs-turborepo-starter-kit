// API path templates of the `docs-publishing` context (ADR 084). Composed into `apiRoutes`
// (`src/api-routes.ts`) as `apiRoutes.docsPublishing`.

import type { RouteTree } from "../../route-tree";

export const docsPublishingRoutes = {
	/** Platform staff: the Operations console's Docs sync page (DOCS_SYNC LIST / READ / CREATE). */
	overview: "/admin/docs-publishing/overview",
	runs: "/admin/docs-publishing/runs",
	run: "/admin/docs-publishing/runs/:id",
	startSync: "/admin/docs-publishing/sync",
	revealHandshake: "/admin/docs-publishing/webhook-handshake/reveal",
} satisfies Record<string, RouteTree>;

/** Where Notion posts its webhook, and where the sync reports. Not session routes, so not in the client contract. */
export const NOTION_WEBHOOK_PATH = "/integrations/notion/webhook";
export const DOCS_SYNC_REPORT_PATH = "/docs-publishing/sync-runs";
