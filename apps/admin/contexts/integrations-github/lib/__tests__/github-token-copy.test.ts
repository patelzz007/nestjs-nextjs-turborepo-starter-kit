import { epochMs, type GithubAccountStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/format/dates";

import { githubTokenSummary } from "../github-token-copy";

const LINKED_AT = epochMs(1_786_300_000_000);
const EXPIRES_AT = epochMs(1_788_900_000_000);

const linked: GithubAccountStatus = { status: "linked", login: "octocat", avatarUrl: null, health: "active", linkedAt: LINKED_AT, tokenExpiresAt: null };

describe("githubTokenSummary", () => {
	it("says pull requests are off when the server has no GitHub set up", () => {
		expect(githubTokenSummary({ status: "off" })).toBe("Pull requests are not set up on this server.");
	});

	it("asks for a token when none is linked", () => {
		expect(githubTokenSummary({ status: "unlinked" })).toBe("Link a fine-grained GitHub token to see and work on your pull requests.");
	});

	it("names the account and when it was linked for a token without an expiry", () => {
		expect(githubTokenSummary(linked)).toBe(`Linked as octocat since ${formatDateTime(LINKED_AT)}. The token does not expire.`);
	});

	it("names the expiry of a token that has one", () => {
		expect(githubTokenSummary({ ...linked, tokenExpiresAt: EXPIRES_AT })).toBe(`Linked as octocat. The token expires ${formatDateTime(EXPIRES_AT)}.`);
	});

	it("asks for a new token once GitHub rejects the linked one", () => {
		expect(githubTokenSummary({ ...linked, health: "rejected" })).toBe("GitHub no longer accepts the token of octocat. Link a new one to continue.");
	});
});
