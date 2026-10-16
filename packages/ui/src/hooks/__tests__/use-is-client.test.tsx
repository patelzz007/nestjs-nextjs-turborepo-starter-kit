// @vitest-environment jsdom
import { act } from "@testing-library/react";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsClient } from "./use-is-client";

function Probe(): React.JSX.Element {
	return <span>{useIsClient() ? "client" : "server"}</span>;
}

let root: Root | undefined;

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	root = undefined;
	document.body.innerHTML = "";
});

describe("useIsClient", () => {
	it("is false while server rendering", () => {
		expect(renderToString(<Probe />)).toBe("<span>server</span>");
	});

	it("hydrates the server markup without a mismatch, then switches to true", () => {
		const container = document.createElement("div");
		container.innerHTML = renderToString(<Probe />);
		document.body.append(container);
		const recoverableError = vi.fn();

		act(() => {
			root = hydrateRoot(container, <Probe />, { onRecoverableError: recoverableError });
		});

		expect(recoverableError).not.toHaveBeenCalled();
		expect(container.textContent).toBe("client");
	});
});
