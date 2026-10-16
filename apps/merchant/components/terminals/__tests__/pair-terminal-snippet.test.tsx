// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { API_VERSION_PREFIX, PosPairTerminalSchema } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { buildPairTerminalSnippet, PAIR_TERMINAL_SNIPPET_TITLE, PAIRING_CODE_PLACEHOLDER, PairTerminalSnippet } from "@/components/terminals/pair-terminal-snippet";

const API = "https://api.example.com/";
/** A code in the pairing alphabet (no 0/O/1/I). */
const SAMPLE_CODE = "KX7M2PQR";

afterEach((): void => {
	cleanup();
});

/** The JSON body between `-d '` and the closing quote of a snippet. */
function bodyOf(snippet: string): string {
	const start = snippet.indexOf("-d '") + "-d '".length;
	return snippet.slice(start, snippet.lastIndexOf("'"));
}

describe("buildPairTerminalSnippet", () => {
	it("posts to the versioned pairing route without an API key (pairing is how the till gets one)", () => {
		const snippet = buildPairTerminalSnippet(API);

		expect(snippet).toContain(`curl -X POST https://api.example.com${API_VERSION_PREFIX}/pos/terminals/pair`);
		expect(snippet).not.toContain("X-API-Key");
		expect(snippet).toContain(PAIRING_CODE_PLACEHOLDER);
	});

	it("shows a body the API accepts once the placeholder is filled in", () => {
		const body = bodyOf(buildPairTerminalSnippet(API)).replace(PAIRING_CODE_PLACEHOLDER, SAMPLE_CODE);

		expect(PosPairTerminalSchema.safeParse(JSON.parse(body)).success).toBe(true);
	});

	it("is ready to run as-is when built with a live code", () => {
		const body = bodyOf(buildPairTerminalSnippet(API, SAMPLE_CODE));

		expect(PosPairTerminalSchema.parse(JSON.parse(body))).toEqual({ pairingCode: SAMPLE_CODE });
	});
});

describe("PairTerminalSnippet", () => {
	it("titles the snippet with the route the till calls", () => {
		render(<PairTerminalSnippet apiBaseUrl={API} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(PAIR_TERMINAL_SNIPPET_TITLE)).toBeTruthy();
		expect(PAIR_TERMINAL_SNIPPET_TITLE).toBe("POST /pos/terminals/pair");
	});
});
