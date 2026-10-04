// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellThemeToggle } from "./shell-theme-toggle";

vi.mock("next-themes", () => ({ useTheme: (): { readonly resolvedTheme: string; readonly setTheme: () => void } => ({ resolvedTheme: "dark", setTheme: vi.fn() }) }));

afterEach((): void => {
	cleanup();
});

describe("ShellThemeToggle", () => {
	it("renders only the hidden placeholder icon on the server (the theme is unknown there)", () => {
		const html = renderToString(<ShellThemeToggle />);

		expect(html).toContain("opacity-0");
	});

	it("renders the real icon on the client, without waiting for an effect or a frame", () => {
		const { container } = render(<ShellThemeToggle />);

		expect(container.querySelector(".opacity-0")).toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
	});
});
