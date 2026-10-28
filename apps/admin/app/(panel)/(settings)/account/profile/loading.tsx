import { ProfilePageSkeleton } from "@/components/loading/account-skeletons";

/**
 * `/account/profile` while the own profile is fetched — mirrors `ProfileView`.
 */
export default function AccountProfileLoading(): React.JSX.Element {
	return <ProfilePageSkeleton />;
}
