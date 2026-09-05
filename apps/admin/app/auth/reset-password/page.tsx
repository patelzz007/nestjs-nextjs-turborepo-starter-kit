"use client";

import { ResetPasswordForm } from "@workspace/client/lib/auth/reset-password-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

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

	return <ResetPasswordForm token={token} loginHref="/auth/login" />;
}

export default function AdminResetPasswordPage(): JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			}
			brandName="Admin Panel"
			tagline="Choose a strong new password."
			features={["Must meet complexity requirements", "Cannot reuse recent passwords", "Other sessions will be signed out"]}
			title="Create new password"
			subtitle="Your new password must be different from previous passwords"
			copyright="Admin Panel"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}
			showBackButton
			backHref="/auth/login"
			backLabel="Back to sign in">
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}>
				<ResetPasswordContent />
			</Suspense>
		</AuthLayout>
	);
}
