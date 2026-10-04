import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/settings` — section index. Platform settings open on Access control, the
 * section's only page. The sidebar lists this URL as a toggle-only parent, so
 * it is only reached by typing or sharing it; the access page's own route rule
 * still applies after the redirect. Server-side `redirect()` throws during
 * render — no client flash.
 */
export default function SettingsIndexPage(): React.ReactNode {
	redirect(ROUTES.settings.access);
}
