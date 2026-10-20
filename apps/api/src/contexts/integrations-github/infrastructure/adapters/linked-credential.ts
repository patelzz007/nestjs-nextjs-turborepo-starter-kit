import type { LinkedGithubCredential } from "../../application/ports/github-credentials.port";
import type { GithubCredential } from "../github-api/github-http.transport";

/** The transport credential of an admin's own linked token — GitHub rejecting it is theirs to fix, not an outage. */
export function linkedTransportCredential(linked: LinkedGithubCredential): GithubCredential {
	return { source: "linked", token: linked.token };
}
