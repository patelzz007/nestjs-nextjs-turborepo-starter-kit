import { apiContract, epochMs, MERCHANT_TERMINALS_PAGE_SIZE, type SerializableInput } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
	apiRouter,
	GITHUB_PULL_REQUESTS_QUERY_ROOT,
	githubPullRequestScopeKey,
	githubPullRequestsRootKey,
	isErasedProcedureDef,
	isRouterSubtree,
	mapRouterTree,
	resolveRequest,
	type ApiQueryKey,
	type ErasedQueryDef,
	type RouterTreeMapper,
} from "../router";

/** A router node: every value of the router tree is an object (a procedure def or a nested router). */
const RouterNodeShapeSchema = z.object({});
const RouterNodesSchema = z.record(
	z.string(),
	z.custom<object>((value): value is object => RouterNodeShapeSchema.safeParse(value).success),
);

/** Every query def of the router, with its dotted name. */
function collectQueryDefs(router: object, prefix = ""): readonly { readonly name: string; readonly def: ErasedQueryDef }[] {
	const found: { readonly name: string; readonly def: ErasedQueryDef }[] = [];
	for (const [key, node] of Object.entries(RouterNodesSchema.parse(router))) {
		const name = `${prefix}${key}`;
		if (isErasedProcedureDef(node)) {
			if (node.kind === "query") found.push({ name, def: node });
			continue;
		}
		if (isRouterSubtree(node)) found.push(...collectQueryDefs(node, `${name}.`));
	}
	return found;
}

/** An input carrying every field any scope reads. `queryKey` / `scopeKey` only read fields — they never parse. */
const SCOPE_PROBE: SerializableInput = {
	tenantSlug: "org-probe",
	tenantId: "org-id-probe",
	userId: "user-probe",
	rewardId: "reward-probe",
	claimId: "claim-probe",
	fileId: "file-probe",
	id: "id-probe",
	owner: "owner-probe",
	repository: "repository-probe",
	number: 1,
};

function startsWith(key: ApiQueryKey, prefix: ApiQueryKey): boolean {
	return prefix.length <= key.length && prefix.every((segment, index) => Object.is(segment, key[index]));
}

describe("query keys of the whole router", () => {
	const queries = collectQueryDefs(apiRouter);

	it("finds the router's queries", () => {
		expect(queries.length).toBeGreaterThan(30);
	});

	it.each(queries)("$name: the scope key (what call sites invalidate with) is a prefix of the query key", ({ def }) => {
		expect(startsWith(def.queryKey(SCOPE_PROBE), def.scopeKey(SCOPE_PROBE))).toBe(true);
	});

	it.each(queries)("$name: the whole input is part of the key, so no input field can share a cache entry", ({ def }) => {
		const key = def.queryKey(SCOPE_PROBE);
		expect(key[key.length - 1]).toBe(SCOPE_PROBE);
	});

	it("an input-less query is keyed by its scope alone", () => {
		expect(apiRouter.auth.me.queryKey(undefined)).toEqual(["auth", "me"]);
		expect(apiRouter.auth.me.scopeKey(undefined)).toEqual(["auth", "me"]);
	});
});

describe("apiRouter.rewardsAdmin.salesAnalytics", () => {
	const def = apiRouter.rewardsAdmin.salesAnalytics;

	it("is an authenticated GET on the contract path", () => {
		expect(def.kind).toBe("query");
		expect(def.method).toBe("GET");
		expect(def.path).toBe(apiContract.rewardsAdmin.salesAnalytics.path);
		expect(def.access).toBe("authenticated");
	});

	it("keys the cache by the period, so each period is cached on its own", () => {
		const from = epochMs(1_788_220_800_000);
		const to = epochMs(1_793_059_200_000);
		expect(def.queryKey({ from, to })).toEqual(["rewards-admin", "analytics", "sales", { from, to }]);
		expect(def.queryKey({})).not.toEqual(def.queryKey({ from, to }));
	});
});

describe("analytics dashboards", () => {
	const from = epochMs(1_788_220_800_000);
	const to = epochMs(1_793_059_200_000);

	it("are authenticated GETs on their contract paths", () => {
		expect([apiRouter.claims.analyticsDashboard.path, apiRouter.tenants.analyticsDashboard.path, apiRouter.rewardsAdmin.analyticsDashboard.path]).toEqual([
			"/claims/analytics/dashboard",
			"/tenants/:tenantSlug/analytics/dashboard",
			"/admin/analytics/dashboard",
		]);
		expect(apiRouter.tenants.analyticsDashboard.access).toBe("authenticated");
	});

	it("key the cache by range, interval and store, so no two views share an entry", () => {
		const merchant = apiRouter.tenants.analyticsDashboard;
		const daily = merchant.queryKey({ tenantSlug: "acme", from, to, interval: "day" });
		expect(daily).toEqual(["tenant", "acme", "analytics", "dashboard", { tenantSlug: "acme", from, to, interval: "day" }]);
		expect(merchant.queryKey({ tenantSlug: "acme", from, to, interval: "week" })).not.toEqual(daily);
		expect(merchant.queryKey({ tenantSlug: "acme", from, to, interval: "day", locationId: "0f0f0f0f-0000-4000-8000-00000000000a" })).not.toEqual(daily);
	});

	it("sit under their audience's analytics scope (invalidating it refreshes the dashboard too)", () => {
		const merchant = apiRouter.tenants.analyticsDashboard;
		expect(startsWith(merchant.queryKey({ tenantSlug: "acme" }), apiRouter.tenants.analytics.scopeKey({ tenantSlug: "acme" }))).toBe(true);
		expect(startsWith(apiRouter.claims.analyticsDashboard.queryKey({ from, to }), apiRouter.claims.analytics.scopeKey({}))).toBe(true);
		expect(apiRouter.rewardsAdmin.analyticsDashboard.queryKey({})).toEqual(["rewards-admin", "analytics", "dashboard", {}]);
	});
});

describe("apiRouter.tenants.updateOwnMembership", () => {
	const updateOwnMembership = apiRouter.tenants.updateOwnMembership;

	it("patches the caller's own membership of the tenant, sending only the display name in the body", () => {
		expect([updateOwnMembership.method, updateOwnMembership.path]).toEqual(["PATCH", apiContract.tenants.updateOwnMembership.path]);
		expect(resolveRequest(updateOwnMembership.path, { tenantSlug: "brew-bean-kl", displayName: null }, { method: updateOwnMembership.method })).toEqual({
			url: "/tenants/brew-bean-kl/members/me",
			body: { displayName: null },
		});
	});
});

describe("apiRouter.tenants.terminals", () => {
	const terminals = apiRouter.tenants.terminals;
	const ORG = "acme-coffee";
	const TERMINAL_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
	const STORE_ID = "0f0f0f0f-0000-4000-8000-00000000000a";

	it("derives every leaf's method and path from the shared contract", () => {
		expect([terminals.list.method, terminals.list.path]).toEqual(["GET", apiContract.tenants.terminals.list.path]);
		expect([terminals.create.method, terminals.create.path]).toEqual(["POST", apiContract.tenants.terminals.create.path]);
		expect([terminals.pairingCode.method, terminals.pairingCode.path]).toEqual(["POST", apiContract.tenants.terminals.pairingCode.path]);
		expect([terminals.remove.method, terminals.remove.path]).toEqual(["DELETE", apiContract.tenants.terminals.remove.path]);
		expect([terminals.settings.method, terminals.settings.path]).toEqual(["GET", apiContract.tenants.terminals.settings.path]);
		expect([terminals.updateSettings.method, terminals.updateSettings.path]).toEqual(["PATCH", apiContract.tenants.terminals.settings.path]);
		expect([terminals.summary.method, terminals.summary.path]).toEqual(["GET", apiContract.tenants.terminals.summary.path]);
		expect([terminals.get.method, terminals.get.path]).toEqual(["GET", apiContract.tenants.terminals.get.path]);
		expect(terminals.list.access).toBe("authenticated");
	});

	it("keys the summary per store and the detail per terminal, under the terminals prefix (one invalidation refreshes both)", () => {
		const everyStore = { tenantSlug: ORG };
		expect(terminals.summary.queryKey(everyStore)).toEqual(["tenant", ORG, "terminals", "summary", everyStore]);
		expect(terminals.summary.queryKey({ ...everyStore, locationId: STORE_ID })).not.toEqual(terminals.summary.queryKey(everyStore));
		expect(terminals.get.queryKey({ tenantSlug: ORG, id: TERMINAL_ID })).toEqual(["tenant", ORG, "terminals", "detail", { tenantSlug: ORG, id: TERMINAL_ID }]);
	});

	it("reads one reward of the tenant by id", () => {
		const rewards = apiRouter.tenants.rewards;
		expect([rewards.get.method, rewards.get.path]).toEqual(["GET", apiContract.tenants.rewards.get.path]);
		expect(rewards.get.queryKey({ tenantSlug: ORG, rewardId: TERMINAL_ID })).toEqual(["tenant", ORG, "rewards", "detail", { tenantSlug: ORG, rewardId: TERMINAL_ID }]);
	});

	it("keys the list by the whole query, so each store's list is cached on its own", () => {
		const everyStore = { tenantSlug: ORG, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE };
		const oneStore = { ...everyStore, locationId: STORE_ID };

		expect(terminals.list.queryKey(everyStore)).toEqual(["tenant", ORG, "terminals", "list", everyStore]);
		expect(terminals.list.queryKey(oneStore)).not.toEqual(terminals.list.queryKey(everyStore));
	});

	it("keys the settings per tenant", () => {
		expect(terminals.settings.queryKey({ tenantSlug: ORG })).toEqual(["tenant", ORG, "terminals", "settings", { tenantSlug: ORG }]);
		expect(terminals.settings.queryKey({ tenantSlug: "other" })).not.toEqual(terminals.settings.queryKey({ tenantSlug: ORG }));
	});

	it("puts the terminal id in the path, not the body, for pairing codes and removal", () => {
		const input = { tenantSlug: ORG, id: TERMINAL_ID };

		expect(resolveRequest(terminals.pairingCode.path, input, { method: terminals.pairingCode.method })).toEqual({
			url: `/tenants/${ORG}/terminals/${TERMINAL_ID}/pairing-code`,
			body: {},
		});
		expect(resolveRequest(terminals.remove.path, input, { method: terminals.remove.method })).toEqual({ url: `/tenants/${ORG}/terminals/${TERMINAL_ID}`, body: {} });
	});

	it("sends the new terminal and the settings toggle as the request body", () => {
		expect(resolveRequest(terminals.create.path, { tenantSlug: ORG, name: "Front counter", locationId: STORE_ID }, { method: terminals.create.method })).toEqual({
			url: `/tenants/${ORG}/terminals`,
			body: { name: "Front counter", locationId: STORE_ID },
		});
		expect(resolveRequest(terminals.updateSettings.path, { tenantSlug: ORG, requireRegisteredTerminals: true }, { method: terminals.updateSettings.method })).toEqual({
			url: `/tenants/${ORG}/terminals/settings`,
			body: { requireRegisteredTerminals: true },
		});
	});
});

describe("cache scopes that used to be hand-typed (and dead)", () => {
	it('the KYB scope of a tenant reaches its KYB query (the old ["merchant", "kyb"] reached nothing)', () => {
		const kyb = apiRouter.tenants.kyb.get;
		expect(startsWith(kyb.queryKey({ tenantSlug: "acme" }), kyb.scopeKey({ tenantSlug: "acme" }))).toBe(true);
		expect(startsWith(kyb.queryKey({ tenantSlug: "acme" }), ["merchant", "kyb"])).toBe(false);
	});

	it("the claims analytics key includes the store filter", () => {
		const analytics = apiRouter.claims.analytics;
		expect(analytics.queryKey({ locationId: "0f0f0f0f-0000-4000-8000-00000000000a" })).not.toEqual(analytics.queryKey({}));
	});
});

describe("mutations", () => {
	it("carry no query key: a mutation is not cached, and its input (tokens, emails) must never become a cache key", () => {
		expect(Object.hasOwn(apiRouter.auth.verifyEmail, "queryKey")).toBe(false);
		expect(Object.hasOwn(apiRouter.tenants.inviteMember, "queryKey")).toBe(false);
	});

	it("start a 2FA enrollment with a POST (it stores a pending secret)", () => {
		expect(apiRouter.auth.twoFactorSetup.kind).toBe("mutation");
		expect(apiRouter.auth.twoFactorSetup.method).toBe("POST");
	});
});

describe("mapRouterTree", () => {
	/** Binds a leaf to its path and a subtree to a marker, so the test sees which branch each key took. */
	const MAPPER: RouterTreeMapper<{ readonly bound: string }> = {
		leaf: (def) => ({ bound: `leaf:${def.path}` }),
		router: () => ({ bound: "router" }),
	};
	const leaf = apiRouter.tenants.updateOwnMembership;

	it("binds procedure leaves and nested routers, and settles every key", () => {
		const mapped = mapRouterTree({ update: leaf, nested: { update: leaf } }, MAPPER);
		expect(mapped.nodes).toEqual({ update: { bound: `leaf:${leaf.path}` }, nested: { bound: "router" } });
		expect([...mapped.settledKeys]).toEqual(["update", "nested"]);
	});

	it.each([
		["a string", "not-a-node"],
		["a number", 42],
		["null", null],
		["a function", (): string => "not-a-node"],
		["an array (its index keys would become route names)", [leaf]],
	])("throws for %s instead of treating it as a router", (_what, node) => {
		expect(() => mapRouterTree({ broken: node }, MAPPER)).toThrow("Invalid router node");
	});
});

describe("resolveRequest path parameters", () => {
	const OWNER = "patelzz007";
	const REPOSITORY = "nestjs-nextjs-turborepo-starter-kit";

	it("fills every :param segment and sends only the other keys as the query string", () => {
		const commits = apiRouter.github.repositoryCommits;

		expect(resolveRequest(commits.path, { owner: OWNER, repository: REPOSITORY, limit: 10 })).toEqual({ url: `/github/repositories/${OWNER}/${REPOSITORY}/commits?limit=10` });
		expect(resolveRequest(apiRouter.github.repositorySummary.path, { owner: OWNER, repository: REPOSITORY })).toEqual({ url: `/github/repositories/${OWNER}/${REPOSITORY}` });
	});

	it("puts a commit's SHA in its path, with nothing left for the query string", () => {
		const sha = "0123456789abcdef0123456789abcdef01234567";

		expect(resolveRequest(apiRouter.github.repositoryCommit.path, { owner: OWNER, repository: REPOSITORY, sha })).toEqual({
			url: `/github/repositories/${OWNER}/${REPOSITORY}/commits/${sha}`,
		});
	});

	it("puts a pull request's number in its path and its files page in the query string", () => {
		const pullRequest = { owner: OWNER, repository: REPOSITORY, number: 42 };

		expect(resolveRequest(apiRouter.githubPullRequests.detail.path, pullRequest)).toEqual({ url: `/github/pull-requests/${OWNER}/${REPOSITORY}/42` });
		expect(resolveRequest(apiRouter.githubPullRequests.files.path, { ...pullRequest, page: 2 })).toEqual({
			url: `/github/pull-requests/${OWNER}/${REPOSITORY}/42/files?page=2`,
		});
		expect(resolveRequest(apiRouter.githubPullRequests.timeline.path, { ...pullRequest, cursor: "c2" })).toEqual({
			url: `/github/pull-requests/${OWNER}/${REPOSITORY}/42/timeline?cursor=c2`,
		});
		const sha = "0123456789abcdef0123456789abcdef01234567";
		expect(resolveRequest(apiRouter.githubPullRequests.commit.path, { ...pullRequest, sha })).toEqual({
			url: `/github/pull-requests/${OWNER}/${REPOSITORY}/42/commits/${sha}`,
		});
	});

	it("percent-encodes a parameter value", () => {
		expect(resolveRequest(apiRouter.auth.adminUserDetail.path, { userId: "a/b c" })).toEqual({ url: "/auth/admin/users/a%2Fb%20c" });
	});

	it("does not depend on RegExp named groups, which React Native's engine does not return from matchAll", () => {
		const matchAll = vi.spyOn(String.prototype, "matchAll").mockImplementation(() => {
			throw new Error("matchAll must not be used to read path parameters");
		});
		try {
			expect(resolveRequest(apiRouter.github.repositorySummary.path, { owner: OWNER, repository: REPOSITORY })).toEqual({
				url: `/github/repositories/${OWNER}/${REPOSITORY}`,
			});
		} finally {
			matchAll.mockRestore();
		}
	});
});

describe("apiRouter.github query keys", () => {
	it("nests every repository view under the list's scope, so one invalidation reloads them all", () => {
		const scope = apiRouter.github.repositories.scopeKey(undefined);
		const params = { owner: "patelzz007", repository: "site" };
		const keys = [
			apiRouter.github.repositorySummary.queryKey(params),
			apiRouter.github.repositoryCommits.queryKey({ ...params, limit: 10 }),
			apiRouter.github.repositoryContributors.queryKey(params),
			apiRouter.github.repositoryCommit.queryKey({ ...params, sha: "0123456789abcdef0123456789abcdef01234567" }),
		];

		for (const key of keys) {
			expect(key.slice(0, scope.length)).toEqual(scope);
		}
	});
});

describe("GitHub pull-request query keys", () => {
	const pullRequest = { owner: "octo-org", repository: "hello-world", number: 42 };

	it("nests every view of one pull request under its scope key", () => {
		const scope = githubPullRequestScopeKey(pullRequest);
		const views = [
			apiRouter.githubPullRequests.detail.queryKey(pullRequest),
			apiRouter.githubPullRequests.timeline.queryKey({ ...pullRequest, cursor: "c2" }),
			apiRouter.githubPullRequests.commits.queryKey(pullRequest),
			apiRouter.githubPullRequests.files.queryKey({ ...pullRequest, page: 1 }),
			apiRouter.githubPullRequests.reviewThreads.queryKey(pullRequest),
			apiRouter.githubPullRequests.commit.queryKey({ ...pullRequest, sha: "0123456789abcdef0123456789abcdef01234567" }),
		];

		for (const key of views) {
			expect(key.slice(0, scope.length)).toEqual(scope);
		}
		expect(githubPullRequestScopeKey({ ...pullRequest, number: 7 })).not.toEqual(scope);
	});

	it("starts every pull-request key with one root, so a token change reloads them all", () => {
		const keys = [
			apiRouter.githubPullRequests.account.queryKey(undefined),
			apiRouter.githubPullRequests.list.queryKey({ filter: "yours", state: "open" }),
			apiRouter.githubPullRequests.detail.queryKey(pullRequest),
			apiRouter.githubPullRequests.contentEdits.queryKey({ nodeId: "IC_abc" }),
		];

		for (const [root] of keys) {
			expect(root).toBe(GITHUB_PULL_REQUESTS_QUERY_ROOT);
		}
		expect(githubPullRequestsRootKey()).toEqual([GITHUB_PULL_REQUESTS_QUERY_ROOT]);
	});
});
