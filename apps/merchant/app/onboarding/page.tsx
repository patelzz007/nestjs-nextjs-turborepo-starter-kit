"use client";

import { ROUTES } from "@/lib/routes";
import { MerchantOnboardingView, MerchantOnboardingViewSkeleton } from "@workspace/client/lib/merchant/onboarding/view";
import { MerchantOnboardingPageFrame } from "@/components/onboarding/onboarding-page-frame";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

function OnboardingContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-destructive/20 bg-card/90 shadow-xs backdrop-blur-sm">
				<div className="h-1 bg-destructive/40" aria-hidden="true" />
				<div className="space-y-2 p-6 sm:p-8">
					<h2 className="text-xl font-semibold tracking-tight">Invalid onboarding link</h2>
					<p className="text-sm text-muted-foreground">This onboarding link is missing a token. Open the invite email again or ask your platform admin to resend it.</p>
				</div>
			</div>
		);
	}

	return <MerchantOnboardingView token={token} loginHref={ROUTES.auth.login} />;
}

export default function MerchantOnboardingPage(): JSX.Element {
	return (
		<MerchantOnboardingPageFrame>
			<Suspense fallback={<MerchantOnboardingViewSkeleton />}>
				<OnboardingContent />
			</Suspense>
		</MerchantOnboardingPageFrame>
	);
}
