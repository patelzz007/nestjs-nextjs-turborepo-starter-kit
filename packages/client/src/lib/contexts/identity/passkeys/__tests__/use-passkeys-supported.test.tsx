// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePasskeysSupported } from "../use-passkeys-supported";

const { supported } = vi.hoisted(() => ({ supported: vi.fn<() => boolean>() }));

vi.mock("../browser-passkeys", () => ({ passkeysSupported: supported }));

function Probe(): React.JSX.Element {
	return <span>{usePasskeysSupported() ? "offered" : "hidden"}</span>;
}

afterEach(() => {
	vi.clearAllMocks();
});

describe("usePasskeysSupported", () => {
	it("answers what the browser supports once rendered in a browser", () => {
		supported.mockReturnValue(true);
		expect(renderHook(() => usePasskeysSupported()).result.current).toBe(true);

		supported.mockReturnValue(false);
		expect(renderHook(() => usePasskeysSupported()).result.current).toBe(false);
	});

	it("never offers a passkey in the server render, whatever the browser would say", () => {
		supported.mockReturnValue(true);

		expect(renderToString(<Probe />)).toContain("hidden");
	});
});
