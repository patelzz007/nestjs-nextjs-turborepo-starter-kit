"use client";

import { ResetPasswordForm } from "@workspace/client/lib/auth/forms/reset-password-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

import { MerchantAuthLogo } from "@/app/auth/merchant-auth-logo";
import { ROUTES } from "@/lib/routes";

/** The `?token=` from the reset email; a missing or blank token gets a clear dead-end message. */
function MerchantResetPasswordContent(): JSX.Element {
	const token = useSearchParams().get("token");

	if (token === null || token.trim().length === 0) {
		return (
			<div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This reset link is invalid. Please request a new password reset email.
			</div>
		);
	}

	return <ResetPasswordForm token={token} loginHref={ROUTES.auth.login} forgotPasswordHref={ROUTES.auth.forgotPassword} />;
}

/** Choose a new password from the link in the reset email (a token link — works even while signed in). */
export default function MerchantResetPasswordPage(): JSX.Element {
	return (
		<AuthLayout
			logo={<MerchantAuthLogo />}
			brandName="Merchant Portal"
			tagline="Choose a strong new password."
			features={["Must meet complexity requirements", "Cannot reuse recent passwords", "Other sessions will be signed out"]}
			title="Create new password"
			subtitle="Your new password must be different from previous passwords"
			copyright="Reward Hub"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}
			showBackButton
			backHref={ROUTES.auth.login}
			backLabel="Back to sign in">
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
				<MerchantResetPasswordContent />
			</Suspense>
		</AuthLayout>
	);
}
