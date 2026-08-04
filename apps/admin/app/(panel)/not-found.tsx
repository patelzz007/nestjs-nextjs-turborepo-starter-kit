import { AdminNotFoundContent } from "@/components/common/not-found-content";

/**
 * Not-found boundary for the authenticated panel. Because it lives inside the
 * `(panel)` route group, it renders **within** `(panel)/layout.tsx` — so the
 * sidebar, topbar, and breadcrumb shell stay mounted and only the content
 * area shows the 404. It is reached when any panel route calls `notFound()`
 * (see the `(panel)/[...slug]` catch-all for unmatched URLs).
 */
export default function PanelNotFound(): React.JSX.Element {
	return (
		<AdminNotFoundContent
			backHref="/"
			backLabel="Back to dashboard"
			message="The page you're looking for doesn't exist or may have been moved. Try navigating from the sidebar."
		/>
	);
}
