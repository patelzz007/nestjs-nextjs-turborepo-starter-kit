"use client";

import { UnsubscribeView } from "@/contexts/notifications/components/unsubscribe-view";
import { ROUTES } from "@/lib/routes";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { BRAND_NAME } from "@workspace/tokens";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

function UnsubscribeContent(): JSX.Element {
	const searchParams = useSearchParams();
	return <UnsubscribeView token={searchParams.get("token")} settingsHref={ROUTES.dashboard.notificationSettings} />;
}

/** `/unsubscribe?token=` — an email footer's unsubscribe link (public: the signed token is the authority). */
export default function WebUnsubscribePage(): JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline="You decide what reaches you."
			features={["One click, no sign-in", "Change your mind any time", "Security notices still reach you"]}
			title="Unsubscribe"
			subtitle="Stop messages like this one"
			copyright={BRAND_NAME}>
			<Suspense fallback={null}>
				<UnsubscribeContent />
			</Suspense>
		</AuthLayout>
	);
}
