import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/analytics` — section index. Analytics opens on sales. The sidebar lists
 * this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function AnalyticsIndexPage(): React.ReactNode {
	redirect(ROUTES.analytics.sales);
}
