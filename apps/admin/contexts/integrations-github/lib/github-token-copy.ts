import { assertNever, type GithubAccountStatus } from "@workspace/shared";

import { formatDateTime } from "@/lib/format/dates";

export const TOKEN_LINKED_MESSAGE = "GitHub token linked.";
export const TOKEN_UNLINKED_MESSAGE = "GitHub token removed.";

/** What the page says about the caller's link: off, not linked, linked (and until when), or rejected by GitHub. */
export function githubTokenSummary(status: GithubAccountStatus): string {
	switch (status.status) {
		case "off":
			return "Pull requests are not set up on this server.";
		case "unlinked":
			return "Link a fine-grained GitHub token to see and work on your pull requests.";
		case "linked":
			if (status.health === "rejected") {
				return `GitHub no longer accepts the token of ${status.login}. Link a new one to continue.`;
			}
			return status.tokenExpiresAt === null
				? `Linked as ${status.login} since ${formatDateTime(status.linkedAt)}. The token does not expire.`
				: `Linked as ${status.login}. The token expires ${formatDateTime(status.tokenExpiresAt)}.`;
		default:
			return assertNever(status, "GitHub account status");
	}
}
