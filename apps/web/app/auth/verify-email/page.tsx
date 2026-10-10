"use client";

import { ROUTES } from "@/lib/routes";
import { VerifyEmailView } from "@workspace/client/lib/auth/email/verify-email-view";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
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

	return <VerifyEmailView token={token} settingsHref={ROUTES.rewardHub.account} />;
}

export default function WebVerifyEmailPage(): JSX.Element {
	return (
		<AuthLayout
			brandName="Reward Hub"
			tagline="Confirm your email to unlock your account."
			features={["One-click verification", "Secure token-based link", "Expires after 24 hours"]}
			title="Verify email"
			subtitle="We're confirming your email address"
			copyright="Reward Hub">
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}>
				<VerifyEmailContent />
			</Suspense>
		</AuthLayout>
	);
}
