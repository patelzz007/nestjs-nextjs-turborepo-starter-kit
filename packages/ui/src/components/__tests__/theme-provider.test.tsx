// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../theme-provider";

/** The next-themes props this provider sets (children aside). */
interface ProviderProps {
	readonly attribute?: string;
	readonly themes?: readonly string[];
	readonly defaultTheme?: string;
	readonly enableSystem?: boolean;
	readonly enableColorScheme?: boolean;
	readonly disableTransitionOnChange?: boolean;
}

const provider = vi.hoisted((): { props: ProviderProps } => ({ props: {} }));
const theme = vi.hoisted(() => ({ resolvedTheme: "light", setTheme: vi.fn<(next: string) => void>() }));

vi.mock("next-themes", () => ({
	ThemeProvider: ({ children, ...props }: ProviderProps & { readonly children: React.ReactNode }): React.JSX.Element => {
		provider.props = props;
		return <>{children}</>;
	},
	useTheme: (): { readonly theme: string; readonly resolvedTheme: string; readonly setTheme: (next: string) => void } => ({
		theme: "system",
		resolvedTheme: theme.resolvedTheme,
		setTheme: theme.setTheme,
	}),
}));

afterEach((): void => {
	cleanup();
	provider.props = {};
	theme.setTheme.mockClear();
});

describe("ThemeProvider", () => {
	it("offers light, dark and Nord as class themes plus the system, with color-scheme left to CSS", () => {
		render(<ThemeProvider>page</ThemeProvider>);

		expect(provider.props.attribute).toBe("class");
		expect(provider.props.themes).toEqual(["light", "dark", "nord"]);
		expect(provider.props.defaultTheme).toBe("system");
		expect(provider.props.enableSystem).toBe(true);
		expect(provider.props.enableColorScheme).toBe(false);
	});

	it("moves to the next theme on D, but not while typing or with a modifier", () => {
		render(
			<ThemeProvider>
				<input aria-label="field" />
			</ThemeProvider>,
		);

		fireEvent.keyDown(window, { key: "d" });
		fireEvent.keyDown(window, { key: "d", metaKey: true });
		fireEvent.keyDown(document.querySelector("input") ?? window, { key: "d" });

		expect(theme.setTheme.mock.calls).toEqual([["dark"]]);
	});
});
