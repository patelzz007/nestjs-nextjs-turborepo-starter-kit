import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/emails` — section index. Emails open on the template browser. The sidebar
 * lists this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function EmailsIndexPage(): React.ReactNode {
	redirect(ROUTES.emails.templates);
}
