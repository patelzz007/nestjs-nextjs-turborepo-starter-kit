"use client";

import { AuthStatusLineSkeleton } from "@/components/loading/auth-form-skeleton";
import { VERIFY_EMAIL_LOADING_LABELS } from "@/components/loading/loading-labels";
import { ROUTES } from "@/lib/routes";
import { VerifyEmailView } from "@workspace/client/lib/contexts/identity/email/verify-email-view";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";
import { BRAND_NAME } from "@workspace/tokens";

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

	return <VerifyEmailView token={token} settingsHref={ROUTES.dashboard.account} />;
}

export default function WebVerifyEmailPage(): JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline="Confirm your email to unlock your account."
			features={["One-click verification", "Secure token-based link", "Expires after 24 hours"]}
			title="Verify email"
			subtitle="We're confirming your email address"
			copyright={BRAND_NAME}>
			<Suspense fallback={<AuthStatusLineSkeleton labels={VERIFY_EMAIL_LOADING_LABELS} />}>
				<VerifyEmailContent />
			</Suspense>
		</AuthLayout>
	);
}
