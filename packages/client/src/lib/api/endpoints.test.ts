import { apiContract, epochMs, MERCHANT_TERMINALS_PAGE_SIZE } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { apiRouter, resolveRequest } from "./endpoints";

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
		expect(def.queryKey({ from, to })).toEqual(["rewards-admin", "analytics", "sales", from, to]);
		expect(def.queryKey({})).toEqual(["rewards-admin", "analytics", "sales", undefined, undefined]);
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
		expect(terminals.list.access).toBe("authenticated");
	});

	it("keys the list by the whole query, so each store's list is cached on its own", () => {
		const everyStore = { orgSlug: ORG, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE };
		const oneStore = { ...everyStore, locationId: STORE_ID };

		expect(terminals.list.queryKey(everyStore)).toEqual(["organization", ORG, "terminals", "list", everyStore]);
		expect(terminals.list.queryKey(oneStore)).not.toEqual(terminals.list.queryKey(everyStore));
	});

	it("keys the settings per organization", () => {
		expect(terminals.settings.queryKey({ orgSlug: ORG })).toEqual(["organization", ORG, "terminals", "settings"]);
		expect(terminals.settings.queryKey({ orgSlug: "other" })).not.toEqual(terminals.settings.queryKey({ orgSlug: ORG }));
	});

	it("puts the terminal id in the path, not the body, for pairing codes and removal", () => {
		const input = { orgSlug: ORG, id: TERMINAL_ID };

		expect(resolveRequest(terminals.pairingCode.path, input, { method: terminals.pairingCode.method })).toEqual({
			url: `/orgs/${ORG}/terminals/${TERMINAL_ID}/pairing-code`,
			body: {},
		});
		expect(resolveRequest(terminals.remove.path, input, { method: terminals.remove.method })).toEqual({ url: `/orgs/${ORG}/terminals/${TERMINAL_ID}`, body: {} });
		expect(terminals.remove.queryKey(input)).toEqual(["organization", ORG, "terminals", "remove", TERMINAL_ID]);
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
