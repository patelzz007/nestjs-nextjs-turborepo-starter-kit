"use client";

import { ResetPasswordForm } from "@workspace/client/lib/auth/forms/reset-password-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";
import { ROUTES } from "@/lib/routes";

function ResetPasswordContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This reset link is invalid. Please request a new password reset email.
			</div>
		);
	}

	return <ResetPasswordForm token={token} />;
}

export default function WebResetPasswordPage(): JSX.Element {
	return (
		<AuthLayout
			brandName="Reward Hub"
			tagline="Choose a strong new password."
			features={["Must meet complexity requirements", "Cannot reuse recent passwords", "Other sessions will be signed out"]}
			title="Create new password"
			subtitle="Your new password must be different from previous passwords"
			copyright="Reward Hub"
			showBackButton
			backHref={ROUTES.auth.login}
			backLabel="Back to sign in">
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}>
				<ResetPasswordContent />
			</Suspense>
		</AuthLayout>
	);
}
