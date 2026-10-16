// The Uniwind boundary under Jest (jest.setup.ts mocks "uniwind" with this
// module). Uniwind compiles the stylesheet in Metro, which Jest does not run,
// so tests render unstyled: classes are not resolved, the theme engine is a
// no-op and CSS variables read as one neutral colour. Suites that assert on
// theme calls or colours override these by spreading this module into their own
// `jest.mock("uniwind", …)` factory.

import * as React from "react";

/** Neutral colour returned for every CSS variable. */
const NEUTRAL_COLOR = "#000000";

export const Uniwind = {
	setTheme: (): void => undefined,
};

/** The resolved theme: light under Jest unless a suite overrides it. */
export function useUniwind(): { readonly theme: "light" | "dark"; readonly hasAdaptiveThemes: boolean } {
	return { theme: "light", hasAdaptiveThemes: true };
}

export function useCSSVariable(): string {
	return NEUTRAL_COLOR;
}

/** Passes the wrapped component through: without the stylesheet, `className` has nothing to map to. */
export function withUniwind<TProps extends object>(Component: React.ComponentType<TProps>): (props: TProps) => React.JSX.Element {
	return function UniwindPassthrough(props: TProps): React.JSX.Element {
		return <Component {...props} />;
	};
}
