import { GithubPullRequestFilterSchema, type GithubPullRequestFilter } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildPullRequestSearch, filterQualifier } from "../pull-request-search.policy";

describe("buildPullRequestSearch", () => {
	it.each<[GithubPullRequestFilter, string]>([
		["yours", "user:octocat"],
		["created", "author:@me"],
		["reviewRequested", "review-requested:@me"],
		["assigned", "assignee:@me"],
		["mentioned", "mentions:@me"],
	])("searches %s with %j", (filter: GithubPullRequestFilter, qualifier: string) => {
		expect(filterQualifier(filter, "octocat")).toBe(qualifier);
	});

	it("always asks for pull requests in live repositories, most recently updated first, in the chosen state", () => {
		expect(buildPullRequestSearch("created", "closed", "octocat")).toBe("is:pr archived:false sort:updated-desc is:closed author:@me");
		expect(buildPullRequestSearch("yours", "open", "octocat")).toBe("is:pr archived:false sort:updated-desc is:open user:octocat");
	});

	it("has a qualifier for every filter the contract offers", () => {
		expect(GithubPullRequestFilterSchema.options.every((filter: GithubPullRequestFilter): boolean => filterQualifier(filter, "octocat").length > 0)).toBe(true);
	});
});
