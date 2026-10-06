// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { ShellThemeToggle } from "./shell-theme-toggle";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

const theme = vi.hoisted(() => ({ setTheme: vi.fn<(theme: string) => void>() }));

vi.mock("next-themes", () => ({
	useTheme: (): { readonly resolvedTheme: string; readonly setTheme: (theme: string) => void } => ({ resolvedTheme: "dark", setTheme: theme.setTheme }),
}));

afterEach((): void => {
	cleanup();
});

/** A label set whose `shellThemeToggle` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, shellThemeToggle: { toggle: "Design wechseln" } };

describe("ShellThemeToggle", () => {
	it("renders only the hidden placeholder icon on the server (the theme is unknown there)", () => {
		const html = renderToString(
			<UiKitTestProviders>
				<ShellThemeToggle />
			</UiKitTestProviders>,
		);

		expect(html).toContain("opacity-0");
	});

	it("renders the real icon on the client, without waiting for an effect or a frame", () => {
		const { container } = render(<ShellThemeToggle />, { wrapper: UiKitTestProviders });

		expect(container.querySelector(".opacity-0")).toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("is named from the shellThemeToggle family, or from `label`", () => {
		const { rerender } = render(<ShellThemeToggle />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.shellThemeToggle.toggle })).toBeTruthy();

		rerender(<ShellThemeToggle label="Changer le thème" />);
		expect(screen.getByRole("button", { name: "Changer le thème" })).toBeTruthy();
	});

	it("runs a caller's onClick, then flips the theme", () => {
		const onClick = vi.fn();
		render(<ShellThemeToggle onClick={onClick} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button"));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(theme.setTheme).toHaveBeenCalledWith("light");
	});

	it("forwards its ref to the button", () => {
		const ref = React.createRef<HTMLElement>();
		render(<ShellThemeToggle ref={ref} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("shell-theme-toggle");
	});

	it("reads its name from the nearest UiKitLabelsProvider", () => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<ShellThemeToggle />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.shellThemeToggle.toggle })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", () => {
		expect(() => render(<ShellThemeToggle />)).toThrow('"shellThemeToggle" labels');
	});
});
