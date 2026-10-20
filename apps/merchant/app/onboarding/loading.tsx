import { MerchantOnboardingPageFrame } from "@/contexts/organizations/components/onboarding/onboarding-page-frame";
import { MerchantOnboardingViewSkeleton } from "@workspace/client/lib/contexts/organizations/onboarding/view";
import type * as React from "react";

/** `/onboarding` while its route loads: the page's own chrome around the wizard's skeleton (its Suspense fallback too). */
export default function MerchantOnboardingLoading(): React.JSX.Element {
	return (
		<MerchantOnboardingPageFrame>
			<MerchantOnboardingViewSkeleton />
		</MerchantOnboardingPageFrame>
	);
}
