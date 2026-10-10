"use client";

import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { ORG_ROUTES, ROUTES } from "@/lib/routes";
import { VerifyEmailView } from "@workspace/client/lib/auth/email/verify-email-view";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

function VerifyEmailContent(): JSX.Element {
	const searchParams = useSearchParams();
	const accountPath = useOrganizationPath(ORG_ROUTES.account);
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This verification link is invalid. Request a new verification email from your account page.
			</div>
		);
	}

	return <VerifyEmailView token={token} settingsHref={accountPath} successRedirectHref={ROUTES.home} loginHref={ROUTES.auth.login} />;
}

export default function MerchantVerifyEmailPage(): JSX.Element {
	return (
		<AuthLayout
			brandName="Merchant Portal"
			tagline="Confirm your email to finish setting up your store account."
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
