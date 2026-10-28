import { SecurityPageSkeleton } from "@/components/loading/account-skeletons";

/**
 * `/account/security` while it streams in — the page header over `SecuritySettingsPanel`.
 */
export default function AccountSecurityLoading(): React.JSX.Element {
	return <SecurityPageSkeleton />;
}
