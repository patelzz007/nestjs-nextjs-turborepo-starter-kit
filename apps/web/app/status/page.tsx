import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { BRAND_NAME } from "@workspace/tokens";
import type { JSX } from "react";

import { PublicStatusView } from "@/contexts/operations/components/public-status-view";

export const dynamic = "force-dynamic";

/** `/status` — is the service working, and what is being done when it isn't (public, enhancement 4.5). */
export default function WebStatusPage(): JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline="Straight answers when something is wrong."
			features={["Every part of the service, checked each minute", "What we're doing about it, as it happens", "No sign-in needed"]}
			title="Service status"
			subtitle={`Is ${BRAND_NAME} working right now?`}
			copyright={BRAND_NAME}>
			<PublicStatusView />
		</AuthLayout>
	);
}
