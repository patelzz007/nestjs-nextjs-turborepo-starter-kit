"use client";

import { VerifyEmailView } from "@workspace/client/lib/auth/verify-email-view";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

function VerifyEmailContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This verification link is invalid. Request a new verification email from your account settings.
			</div>
		);
	}

	return <VerifyEmailView token={token} settingsHref="/rewardhub/settings" />;
}

export default function WebVerifyEmailPage(): JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
			}
			brandName="Reward Hub"
			tagline="Confirm your email to unlock your account."
			features={["One-click verification", "Secure token-based link", "Expires after 24 hours"]}
			title="Verify email"
			subtitle="We're confirming your email address"
			copyright="Reward Hub"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}>
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}>
				<VerifyEmailContent />
			</Suspense>
		</AuthLayout>
	);
}
