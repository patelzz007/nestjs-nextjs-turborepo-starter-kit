import { SecurityPageSkeleton } from "@/components/loading/account-skeletons";

/**
 * `/account` redirects to the security settings, so it waits in that page's shape.
 */
export default function AccountLoading(): React.JSX.Element {
	return <SecurityPageSkeleton />;
}
