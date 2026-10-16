import { PullRequestRouteParamsSchema, toPullRequestRouteParams } from "../route-params";

describe("pull request route params", () => {
	it("round-trips a pull request through the URL's string params", () => {
		const params = toPullRequestRouteParams({ owner: "octo-org", repository: "hello-world", number: 42 });
		expect(params).toEqual({ owner: "octo-org", repository: "hello-world", number: "42" });
		expect(PullRequestRouteParamsSchema.parse(params)).toEqual({ owner: "octo-org", repository: "hello-world", number: 42 });
	});

	it("ignores other search params and refuses a link that names no pull request", () => {
		expect(PullRequestRouteParamsSchema.safeParse({ owner: "octo-org", repository: "hello-world", number: "42", from: "push" }).success).toBe(true);
		expect(PullRequestRouteParamsSchema.safeParse({ owner: "octo-org", repository: "hello-world", number: "zero" }).success).toBe(false);
		expect(PullRequestRouteParamsSchema.safeParse({ owner: "octo-org", number: "42" }).success).toBe(false);
	});
});
