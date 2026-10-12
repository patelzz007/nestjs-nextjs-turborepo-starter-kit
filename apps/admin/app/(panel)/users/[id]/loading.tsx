import { UserDetailPageSkeleton } from "@/components/loading/user-skeletons";

/**
 * `/users/[id]` while the user and the access catalogs are fetched — mirrors `UserDetailView`.
 */
export default function UserDetailLoading(): React.JSX.Element {
	return <UserDetailPageSkeleton />;
}
