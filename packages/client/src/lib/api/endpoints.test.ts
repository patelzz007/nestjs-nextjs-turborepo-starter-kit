import { apiContract, epochMs, MERCHANT_TERMINALS_PAGE_SIZE, type SerializableInput } from "@workspace/shared";
import type { QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiRouter, isErasedProcedureDef, isRouterSubtree, resolveRequest, type ErasedQueryDef } from "./endpoints";

/** A router node: every value of the router tree is an object (a procedure def or a nested router). */
const RouterNodesSchema = z.record(
	z.string(),
	z.custom<object>((value): value is object => typeof value === "object" && value !== null),
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
	orgSlug: "org-probe",
	organizationId: "org-id-probe",
	userId: "user-probe",
	rewardId: "reward-probe",
	claimId: "claim-probe",
	fileId: "file-probe",
	id: "id-probe",
};

function startsWith(key: QueryKey, prefix: QueryKey): boolean {
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

describe("apiRouter.organizations.updateOwnMembership", () => {
	const updateOwnMembership = apiRouter.organizations.updateOwnMembership;

	it("patches the caller's own membership of the organization, sending only the display name in the body", () => {
		expect([updateOwnMembership.method, updateOwnMembership.path]).toEqual(["PATCH", apiContract.organizations.updateOwnMembership.path]);
		expect(resolveRequest(updateOwnMembership.path, { orgSlug: "brew-bean-kl", displayName: null }, { method: updateOwnMembership.method })).toEqual({
			url: "/orgs/brew-bean-kl/members/me",
			body: { displayName: null },
		});
	});
});

describe("apiRouter.organizations.terminals", () => {
	const terminals = apiRouter.organizations.terminals;
	const ORG = "acme-coffee";
	const TERMINAL_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
	const STORE_ID = "0f0f0f0f-0000-4000-8000-00000000000a";

	it("derives every leaf's method and path from the shared contract", () => {
		expect([terminals.list.method, terminals.list.path]).toEqual(["GET", apiContract.organizations.terminals.list.path]);
		expect([terminals.create.method, terminals.create.path]).toEqual(["POST", apiContract.organizations.terminals.create.path]);
		expect([terminals.pairingCode.method, terminals.pairingCode.path]).toEqual(["POST", apiContract.organizations.terminals.pairingCode.path]);
		expect([terminals.remove.method, terminals.remove.path]).toEqual(["DELETE", apiContract.organizations.terminals.remove.path]);
		expect([terminals.settings.method, terminals.settings.path]).toEqual(["GET", apiContract.organizations.terminals.settings.path]);
		expect([terminals.updateSettings.method, terminals.updateSettings.path]).toEqual(["PATCH", apiContract.organizations.terminals.settings.path]);
		expect([terminals.summary.method, terminals.summary.path]).toEqual(["GET", apiContract.organizations.terminals.summary.path]);
		expect([terminals.get.method, terminals.get.path]).toEqual(["GET", apiContract.organizations.terminals.get.path]);
		expect(terminals.list.access).toBe("authenticated");
	});

	it("keys the summary per store and the detail per terminal, under the terminals prefix (one invalidation refreshes both)", () => {
		const everyStore = { orgSlug: ORG };
		expect(terminals.summary.queryKey(everyStore)).toEqual(["organization", ORG, "terminals", "summary", everyStore]);
		expect(terminals.summary.queryKey({ ...everyStore, locationId: STORE_ID })).not.toEqual(terminals.summary.queryKey(everyStore));
		expect(terminals.get.queryKey({ orgSlug: ORG, id: TERMINAL_ID })).toEqual(["organization", ORG, "terminals", "detail", { orgSlug: ORG, id: TERMINAL_ID }]);
	});

	it("reads one reward of the organization by id", () => {
		const rewards = apiRouter.organizations.rewards;
		expect([rewards.get.method, rewards.get.path]).toEqual(["GET", apiContract.organizations.rewards.get.path]);
		expect(rewards.get.queryKey({ orgSlug: ORG, rewardId: TERMINAL_ID })).toEqual(["organization", ORG, "rewards", "detail", { orgSlug: ORG, rewardId: TERMINAL_ID }]);
	});

	it("keys the list by the whole query, so each store's list is cached on its own", () => {
		const everyStore = { orgSlug: ORG, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE };
		const oneStore = { ...everyStore, locationId: STORE_ID };

		expect(terminals.list.queryKey(everyStore)).toEqual(["organization", ORG, "terminals", "list", everyStore]);
		expect(terminals.list.queryKey(oneStore)).not.toEqual(terminals.list.queryKey(everyStore));
	});

	it("keys the settings per organization", () => {
		expect(terminals.settings.queryKey({ orgSlug: ORG })).toEqual(["organization", ORG, "terminals", "settings", { orgSlug: ORG }]);
		expect(terminals.settings.queryKey({ orgSlug: "other" })).not.toEqual(terminals.settings.queryKey({ orgSlug: ORG }));
	});

	it("puts the terminal id in the path, not the body, for pairing codes and removal", () => {
		const input = { orgSlug: ORG, id: TERMINAL_ID };

		expect(resolveRequest(terminals.pairingCode.path, input, { method: terminals.pairingCode.method })).toEqual({
			url: `/orgs/${ORG}/terminals/${TERMINAL_ID}/pairing-code`,
			body: {},
		});
		expect(resolveRequest(terminals.remove.path, input, { method: terminals.remove.method })).toEqual({ url: `/orgs/${ORG}/terminals/${TERMINAL_ID}`, body: {} });
	});

	it("sends the new terminal and the settings toggle as the request body", () => {
		expect(resolveRequest(terminals.create.path, { orgSlug: ORG, name: "Front counter", locationId: STORE_ID }, { method: terminals.create.method })).toEqual({
			url: `/orgs/${ORG}/terminals`,
			body: { name: "Front counter", locationId: STORE_ID },
		});
		expect(resolveRequest(terminals.updateSettings.path, { orgSlug: ORG, requireRegisteredTerminals: true }, { method: terminals.updateSettings.method })).toEqual({
			url: `/orgs/${ORG}/terminals/settings`,
			body: { requireRegisteredTerminals: true },
		});
	});
});

describe("cache scopes that used to be hand-typed (and dead)", () => {
	it('the KYB scope of an organization reaches its KYB query (the old ["merchant", "kyb"] reached nothing)', () => {
		const kyb = apiRouter.organizations.kyb.get;
		expect(startsWith(kyb.queryKey({ orgSlug: "acme" }), kyb.scopeKey({ orgSlug: "acme" }))).toBe(true);
		expect(startsWith(kyb.queryKey({ orgSlug: "acme" }), ["merchant", "kyb"])).toBe(false);
	});

	it("the claims analytics key includes the store filter", () => {
		const analytics = apiRouter.claims.analytics;
		expect(analytics.queryKey({ locationId: "0f0f0f0f-0000-4000-8000-00000000000a" })).not.toEqual(analytics.queryKey({}));
	});
});

describe("mutations", () => {
	it("carry no query key: a mutation is not cached, and its input (tokens, emails) must never become a cache key", () => {
		expect(Object.hasOwn(apiRouter.auth.verifyEmail, "queryKey")).toBe(false);
		expect(Object.hasOwn(apiRouter.organizations.inviteMember, "queryKey")).toBe(false);
	});

	it("start a 2FA enrollment with a POST (it stores a pending secret)", () => {
		expect(apiRouter.auth.twoFactorSetup.kind).toBe("mutation");
		expect(apiRouter.auth.twoFactorSetup.method).toBe("POST");
	});
});
