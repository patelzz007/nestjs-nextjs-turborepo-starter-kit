import { describe, expect, it } from "vitest";

import {
	apiKeyScopeLabel,
	DEFAULT_API_KEY_SCOPE_CHOICE,
	defaultApiKeyStoreChoice,
	ORGANIZATION_WIDE_STORE_CHOICE,
	parseCreateApiKeyForm,
	type ApiKeyStoreChoices,
} from "@/lib/api-keys/create-api-key-form";
import { STORE_A, STORE_B } from "@/test/terminals";

const ALL_LOCATIONS_MEMBER: ApiKeyStoreChoices = { stores: [STORE_A, STORE_B], allowOrganizationWide: true };
const STORE_LIMITED_MEMBER: ApiKeyStoreChoices = { stores: [STORE_B], allowOrganizationWide: false };
const OTHER_STORE_ID = "0f0f0f0f-0000-4000-8000-0000000000ff";

describe("parseCreateApiKeyForm", () => {
	it("limits the key to the chosen store", () => {
		expect(parseCreateApiKeyForm({ name: "  Front counter  ", storeChoice: STORE_B.id, scope: "POS" }, ALL_LOCATIONS_MEMBER)).toEqual({
			name: "Front counter",
			locationId: STORE_B.id,
			scope: "POS",
		});
	});

	it("creates an organization-wide key only when explicitly chosen by an all-locations member", () => {
		expect(parseCreateApiKeyForm({ name: "HQ", storeChoice: ORGANIZATION_WIDE_STORE_CHOICE, scope: "POS" }, ALL_LOCATIONS_MEMBER)).toEqual({ name: "HQ", scope: "POS" });
		expect(parseCreateApiKeyForm({ name: "HQ", storeChoice: ORGANIZATION_WIDE_STORE_CHOICE, scope: "POS" }, STORE_LIMITED_MEMBER)).toBeUndefined();
	});

	it("refuses a missing store, a store outside the member's scope, and a blank name", () => {
		expect(parseCreateApiKeyForm({ name: "Till", storeChoice: "", scope: "POS" }, ALL_LOCATIONS_MEMBER)).toBeUndefined();
		expect(parseCreateApiKeyForm({ name: "Till", storeChoice: STORE_A.id, scope: "POS" }, STORE_LIMITED_MEMBER)).toBeUndefined();
		expect(parseCreateApiKeyForm({ name: "Till", storeChoice: OTHER_STORE_ID, scope: "POS" }, ALL_LOCATIONS_MEMBER)).toBeUndefined();
		expect(parseCreateApiKeyForm({ name: "   ", storeChoice: STORE_A.id, scope: "POS" }, ALL_LOCATIONS_MEMBER)).toBeUndefined();
	});
});

describe("API key scope", () => {
	it("passes the chosen scope through the shared schema", () => {
		expect(parseCreateApiKeyForm({ name: "Back office", storeChoice: STORE_B.id, scope: "INTEGRATION" }, ALL_LOCATIONS_MEMBER)).toEqual({
			name: "Back office",
			locationId: STORE_B.id,
			scope: "INTEGRATION",
		});
	});

	it("refuses a scope the API does not know", () => {
		expect(parseCreateApiKeyForm({ name: "Back office", storeChoice: STORE_B.id, scope: "ADMIN" }, ALL_LOCATIONS_MEMBER)).toBeUndefined();
	});

	it("labels every scope and defaults to the least privilege", () => {
		expect(apiKeyScopeLabel("POS")).toBe("POS terminal");
		expect(apiKeyScopeLabel("INTEGRATION")).toBe("Integration");
		expect(DEFAULT_API_KEY_SCOPE_CHOICE).toBe("POS");
	});
});

describe("defaultApiKeyStoreChoice", () => {
	it("preselects the store in view when the member may use it", () => {
		expect(defaultApiKeyStoreChoice(ALL_LOCATIONS_MEMBER, STORE_A.id)).toBe(STORE_A.id);
		expect(defaultApiKeyStoreChoice(STORE_LIMITED_MEMBER, STORE_A.id)).toBe(STORE_B.id);
	});

	it("never preselects organization-wide — under All locations the member must pick", () => {
		expect(defaultApiKeyStoreChoice(ALL_LOCATIONS_MEMBER, undefined)).toBe("");
	});
});
