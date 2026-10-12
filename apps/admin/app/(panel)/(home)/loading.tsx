import { DashboardPageSkeleton } from "@/components/loading/dashboard-skeletons";

/**
 * `/` while it streams in — the demo index, the platform-sales headline and the first gallery sections (`dashboard-gallery.tsx`).
 */
export default function DashboardLoading(): React.JSX.Element {
	return <DashboardPageSkeleton />;
}
