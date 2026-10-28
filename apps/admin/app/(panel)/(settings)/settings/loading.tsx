import { AccessControlPageSkeleton } from "@/components/loading/access-control-skeletons";

/**
 * `/settings` redirects to access control, so it waits in that page's shape.
 */
export default function SettingsLoading(): React.JSX.Element {
	return <AccessControlPageSkeleton />;
}
