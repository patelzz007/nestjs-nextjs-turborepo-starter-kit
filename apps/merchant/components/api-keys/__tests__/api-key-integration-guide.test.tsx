// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { API_VERSION_PREFIX, RedemptionCheckoutSchema } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiKeyIntegrationGuide, buildCheckoutSnippet, buildValidateRedemptionSnippet } from "@/components/api-keys/api-key-integration-guide";

const API = "https://api.example.com/";
const TERMINALS_HREF = "/orgs/acme-coffee/terminals";

afterEach((): void => {
	cleanup();
});

/** The JSON body between `-d '` and the closing quote of a snippet. */
function bodyOf(snippet: string): string {
	const start = snippet.indexOf("-d '") + "-d '".length;
	return snippet.slice(start, snippet.lastIndexOf("'"));
}

describe("POS integration snippets", () => {
	it("target the versioned endpoints with both POS headers", () => {
		for (const snippet of [buildValidateRedemptionSnippet(API), buildCheckoutSnippet(API)]) {
			expect(snippet).toContain(`https://api.example.com${API_VERSION_PREFIX}/redemptions/`);
			expect(snippet).toContain('-H "X-API-Key: <your-terminal-key>"');
			expect(snippet).toContain('-H "X-Terminal-Id: FRONT-COUNTER-01"');
		}
	});

	it("shows a checkout body the API accepts once the placeholders are filled in", () => {
		const body = bodyOf(buildCheckoutSnippet(API)).replace("<new UUID for this bill>", "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a").replace("<QR token>", "t".repeat(32));

		expect(RedemptionCheckoutSchema.safeParse(JSON.parse(body)).success).toBe(true);
	});
});

describe("ApiKeyIntegrationGuide", () => {
	it("lists the three POS steps and switches between the example requests", () => {
		render(<ApiKeyIntegrationGuide apiBaseUrl={API} terminalsHref={TERMINALS_HREF} />, { wrapper: UiKitTestProviders });
		const guide = screen.getByRole("region", { name: "Connect a terminal" });

		expect(within(guide).getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
		expect(within(guide).getByText("POST /redemptions/validate")).toBeTruthy();

		fireEvent.click(within(guide).getByRole("tab", { name: "3 · Check out" }));
		expect(within(guide).getByText("POST /redemptions/checkout")).toBeTruthy();
	});

	it("starts by pairing the till on the POS terminals page, keeping manual keys for server-to-server use", () => {
		render(<ApiKeyIntegrationGuide apiBaseUrl={API} terminalsHref={TERMINALS_HREF} />, { wrapper: UiKitTestProviders });
		const guide = screen.getByRole("region", { name: "Connect a terminal" });

		expect(within(guide).getByText("Pair the till")).toBeTruthy();
		expect(within(guide).getByRole("link", { name: "POS terminals" }).getAttribute("href")).toBe(TERMINALS_HREF);
		expect(within(guide).getByText(/server-to-server integrations/u)).toBeTruthy();
	});
});
