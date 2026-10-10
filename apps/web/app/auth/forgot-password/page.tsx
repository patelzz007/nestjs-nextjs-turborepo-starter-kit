"use client";

import { ForgotPasswordForm } from "@workspace/client/lib/auth/forms/forgot-password-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { ROUTES } from "@/lib/routes";

export default function WebForgotPasswordPage(): React.JSX.Element {
	return (
		<AuthLayout
			brandName="Reward Hub"
			tagline="Recover access to your rewards account."
			features={["Secure password reset links", "Links expire after 1 hour", "All sessions are revoked after reset"]}
			title="Reset password"
			subtitle="Enter your email and we'll send you a reset link"
			copyright="Reward Hub"
			showBackButton
			backHref={ROUTES.auth.login}
			backLabel="Back to sign in">
			<ForgotPasswordForm />
		</AuthLayout>
	);
}
