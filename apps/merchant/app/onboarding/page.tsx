"use client";

import { MerchantOnboardingView } from "@workspace/client/lib/auth/merchant-onboarding-view";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

function OnboardingContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This onboarding link is missing a token. Open the invite email again or ask your platform admin to resend it.
			</div>
		);
	}

	return <MerchantOnboardingView token={token} loginHref="/auth/login" />;
}

export default function MerchantOnboardingPage(): JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
				</svg>
			}
			brandName="Merchant Portal"
			tagline="Accept your invite and set up the owner account for your store."
			features={["Secure one-time invite links", "Create your owner login", "Submit business verification documents", "Start publishing rewards after sign-in"]}
			title="Merchant onboarding"
			subtitle="Complete setup for your store"
			copyright="Reward Hub"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}>
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
				<OnboardingContent />
			</Suspense>
		</AuthLayout>
	);
}
