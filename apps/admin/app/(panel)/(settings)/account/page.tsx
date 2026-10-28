import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/account` — the signed-in admin's personal settings. Restricted sessions
 * (email not verified / MFA not enrolled) are sent here by the proxy
 * (`getEnrollmentRedirectPath("admin", …)`) and may only visit `/account/**`,
 * so the index opens on Security: that page renders the email-verification and
 * two-factor enrollment panels and shows the pending enrollment message.
 */
export default function AccountIndexPage(): React.ReactNode {
	redirect(ROUTES.account.security);
}
