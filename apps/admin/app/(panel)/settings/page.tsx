import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/settings` — section index. Platform settings open on Billing, the one tab every admin can see. The sidebar
 * lists this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function SettingsIndexPage(): React.ReactNode {
	redirect(ROUTES.settings.billing);
}
