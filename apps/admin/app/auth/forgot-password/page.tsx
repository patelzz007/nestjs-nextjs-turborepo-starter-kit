import { ForgotPasswordForm } from "@workspace/client/lib/auth/forms/forgot-password-form";
import { formatLinkLifetimeHours, PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";

import { AdminAuthLayout } from "@/components/auth/admin-auth-layout";

/** `/auth/forgot-password` — requests a password-reset email for an admin account. */
export default function AdminForgotPasswordPage(): React.JSX.Element {
	return (
		<AdminAuthLayout
			tagline="Recover access to your administrator account."
			features={["Secure password reset links", `Links expire after ${formatLinkLifetimeHours(PASSWORD_RESET_LINK_TTL_HOURS)}`, "All sessions are revoked after reset"]}
			title="Reset password"
			subtitle="Enter your email and we'll send you a reset link"
			showBackToLogin>
			<ForgotPasswordForm />
		</AdminAuthLayout>
	);
}
