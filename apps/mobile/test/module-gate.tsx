// A gate in front of a lazily loaded module, for the screens whose heavy body
// is loaded with `lazyView` (src/lib/lazy-view.tsx). In Jest, `import()` is a
// `require` behind one resolved promise, so the module loads inside the render
// that asks for it and the skeleton in front of it is never seen. A test that
// must see it mocks the module with `jest.requireActual` (the real code) and:
//
// - `evaluated(module)` in the factory, to count when the module is evaluated
//   (proving the screen does not evaluate it before it renders), and
// - `gated(View)` around the body, which holds it (suspends) until `open()`,
//   so the screen's own Suspense boundary shows its skeleton until then.
//
// Variables a `jest.mock` factory reads must start with `mock`
// (`const mockGate = createModuleGate()`).

import { act } from "@testing-library/react-native";
import * as React from "react";

export interface ModuleGate {
	/** Counts one evaluation of the mocked module and passes its exports through. */
	readonly evaluated: <Module extends object>(module: Module) => Module;
	/** How many times the mocked module has been evaluated. */
	readonly evaluations: () => number;
	/** `View`, held (suspended) until the gate opens. */
	readonly gated: <Props extends object>(View: React.ComponentType<Props>) => React.ComponentType<Props>;
	/** Opens the gate and lets React draw what was held. */
	readonly open: () => Promise<void>;
}

export function createModuleGate(): ModuleGate {
	const state = { evaluations: 0 };
	const opened: { resolve: () => void } = { resolve: (): void => undefined };
	const isOpen = new Promise<void>((resolve): void => {
		opened.resolve = resolve;
	});
	return {
		evaluated: <Module extends object>(module: Module): Module => {
			state.evaluations += 1;
			return module;
		},
		evaluations: (): number => state.evaluations,
		gated: <Props extends object>(View: React.ComponentType<Props>): React.ComponentType<Props> => {
			function Gated(props: Props): React.JSX.Element {
				React.use(isOpen);
				return <View {...props} />;
			}
			return Gated;
		},
		open: async (): Promise<void> => {
			await act(async (): Promise<void> => {
				opened.resolve();
				await isOpen;
			});
		},
	};
}
