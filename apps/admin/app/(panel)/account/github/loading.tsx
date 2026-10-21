import { GithubTokenPageSkeleton } from "@/components/loading/account-skeletons";

/**
 * `/account/github` while it streams in — the page header over the token cards.
 */
export default function AccountGithubLoading(): React.JSX.Element {
	return <GithubTokenPageSkeleton withHeader />;
}
