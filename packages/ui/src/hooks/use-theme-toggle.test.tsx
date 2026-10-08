// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useThemeToggle } from "./use-theme-toggle";

const theme = vi.hoisted(() => ({ resolvedTheme: "dark", setTheme: vi.fn<(theme: string) => void>() }));
const transition = vi.hoisted(() => {
	const origins: { readonly x: number; readonly y: number }[] = [];
	return { origins };
});

vi.mock("next-themes", () => ({
	useTheme: (): { readonly resolvedTheme: string; readonly setTheme: (next: string) => void } => ({ resolvedTheme: theme.resolvedTheme, setTheme: theme.setTheme }),
}));

vi.mock("@workspace/ui/lib/core/theme-transition", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/ui/lib/core/theme-transition")>();
	return {
		...actual,
		runThemeTransition: (apply: () => void, origin: { readonly x: number; readonly y: number }): void => {
			transition.origins.push(origin);
			apply();
		},
	};
});

afterEach((): void => {
	cleanup();
	document.body.innerHTML = "";
	transition.origins.length = 0;
	theme.setTheme.mockClear();
});

/** Puts a visible shell theme toggle on the page, centred at (110, 30). */
function mountShellToggle(): HTMLElement {
	const toggle = document.createElement("button");
	toggle.dataset.slot = "shell-theme-toggle";
	toggle.getBoundingClientRect = (): DOMRect => new DOMRect(100, 20, 20, 20);
	document.body.append(toggle);
	return toggle;
}

describe("useThemeToggle", () => {
	it("flips the resolved theme through next-themes", () => {
		const { result } = renderHook(() => useThemeToggle());

		result.current.toggleTheme();

		expect(theme.setTheme).toHaveBeenCalledWith("light");
		expect(result.current.resolvedTheme).toBe("dark");
	});

	it("starts the reveal from the control that was used", () => {
		const { result } = renderHook(() => useThemeToggle());
		const control = document.createElement("button");
		control.getBoundingClientRect = (): DOMRect => new DOMRect(10, 10, 20, 20);

		result.current.toggleTheme(control);

		expect(transition.origins).toEqual([{ x: 20, y: 20 }]);
	});

	it("starts a hotkey or palette switch from the shell's theme toggle when it is on screen", () => {
		mountShellToggle();
		const { result } = renderHook(() => useThemeToggle());

		result.current.toggleTheme();

		expect(transition.origins).toEqual([{ x: 110, y: 30 }]);
	});
});
