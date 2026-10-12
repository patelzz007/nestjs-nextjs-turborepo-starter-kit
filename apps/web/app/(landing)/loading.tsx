import { LandingShell } from "@/components/landing/landing-shell";
import { LandingPageSkeleton } from "@/components/loading/landing-page-skeleton";
import * as React from "react";

/**
 * `/` while the server reads the session and the catalog. Lives in the
 * `(landing)` route group so it covers the landing page alone — at the app
 * root it would also become the fallback of every other route.
 */
export default function LandingLoading(): React.JSX.Element {
	return (
		<LandingShell>
			<LandingPageSkeleton />
		</LandingShell>
	);
}
