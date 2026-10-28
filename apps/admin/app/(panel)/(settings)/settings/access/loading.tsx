import { AccessControlPageSkeleton } from "@/components/loading/access-control-skeletons";

/**
 * `/settings/access` while the role and permission catalogs are fetched — mirrors `AccessControlPanel`.
 */
export default function AccessControlLoading(): React.JSX.Element {
	return <AccessControlPageSkeleton />;
}
