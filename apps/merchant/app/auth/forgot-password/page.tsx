"use client";

import { ForgotPasswordForm } from "@workspace/client/lib/auth/forms/forgot-password-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import type { JSX } from "react";

import { MerchantAuthLogo } from "@/app/auth/merchant-auth-logo";
import { ROUTES } from "@/lib/routes";

/**
 * Request a password-reset email. The form sends `X-Client-Type: merchant`
 * (the merchant auth provider's client type), so the API builds the reset
 * link to THIS app's `/auth/reset-password`.
 */
export default function MerchantForgotPasswordPage(): JSX.Element {
	return (
		<AuthLayout
			logo={<MerchantAuthLogo />}
			brandName="Merchant Portal"
			tagline="Recover access to your store account."
			features={["Secure password reset links", "Links expire after 1 hour", "All sessions are signed out after reset"]}
			title="Reset password"
			subtitle="Enter your store account email and we'll send you a reset link"
			copyright="Reward Hub"
			showBackButton
			backHref={ROUTES.auth.login}
			backLabel="Back to sign in">
			<ForgotPasswordForm loginHref={ROUTES.auth.login} />
		</AuthLayout>
	);
}
