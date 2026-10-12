import { AnalyticsPageSkeleton } from "@/components/loading/dashboard-skeletons";

/**
 * `/analytics` while the dashboard prefetch runs — mirrors `PlatformAnalyticsDashboard`.
 */
export default function AnalyticsLoading(): React.JSX.Element {
	return <AnalyticsPageSkeleton />;
}
