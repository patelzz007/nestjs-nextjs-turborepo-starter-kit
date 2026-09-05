"use client";

import { ForgotPasswordForm } from "@workspace/client/lib/auth/forgot-password-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";

export default function WebForgotPasswordPage(): React.JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			}
			brandName="Reward Hub"
			tagline="Recover access to your rewards account."
			features={["Secure password reset links", "Links expire after 1 hour", "All sessions are revoked after reset"]}
			title="Reset password"
			subtitle="Enter your email and we'll send you a reset link"
			copyright="Reward Hub"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}
			showBackButton
			backHref="/auth/login"
			backLabel="Back to sign in">
			<ForgotPasswordForm />
		</AuthLayout>
	);
}
