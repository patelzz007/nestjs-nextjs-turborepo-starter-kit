// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLayoutTransitionSignal, LayoutTransitionProvider, useLayoutTransitionListener, useReportLayoutTransition } from "../layout-transition";

afterEach((): void => {
	cleanup();
});

describe("createLayoutTransitionSignal", () => {
	it("tells every listener when a motion starts and ends", (): void => {
		const signal = createLayoutTransitionSignal();
		const first = vi.fn<(isMoving: boolean) => void>();
		const second = vi.fn<(isMoving: boolean) => void>();
		signal.subscribe(first);
		signal.subscribe(second);

		signal.report(true);
		signal.report(false);

		expect(first.mock.calls).toEqual([[true], [false]]);
		expect(second.mock.calls).toEqual([[true], [false]]);
	});

	it("ignores a report of the state it is already in", (): void => {
		const signal = createLayoutTransitionSignal();
		const listener = vi.fn<(isMoving: boolean) => void>();
		signal.subscribe(listener);

		signal.report(false);
		signal.report(true);
		signal.report(true);

		expect(listener.mock.calls).toEqual([[true]]);
	});

	it("stops calling a listener once it unsubscribes", (): void => {
		const signal = createLayoutTransitionSignal();
		const listener = vi.fn<(isMoving: boolean) => void>();
		const unsubscribe = signal.subscribe(listener);

		unsubscribe();
		signal.report(true);

		expect(listener).not.toHaveBeenCalled();
	});
});

describe("LayoutTransitionProvider", () => {
	it("reaches a listener without re-rendering it, and lets it go on unmount", (): void => {
		const listener = vi.fn<(isMoving: boolean) => void>();
		const renders = vi.fn<() => void>();
		const reporter: { report: (isMoving: boolean) => void } = { report: (): void => undefined };
		function Reporter(): null {
			reporter.report = useReportLayoutTransition();
			return null;
		}
		function Listener(): null {
			renders();
			useLayoutTransitionListener(listener);
			return null;
		}
		const { rerender } = render(
			<LayoutTransitionProvider>
				<Reporter />
				<Listener />
			</LayoutTransitionProvider>,
		);

		act((): void => {
			reporter.report(true);
			reporter.report(false);
		});
		expect(listener.mock.calls).toEqual([[true], [false]]);
		expect(renders).toHaveBeenCalledTimes(1);

		rerender(
			<LayoutTransitionProvider>
				<Reporter />
			</LayoutTransitionProvider>,
		);
		act((): void => {
			reporter.report(true);
		});
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("has nothing to tell outside a provider", (): void => {
		const listener = vi.fn<(isMoving: boolean) => void>();
		function Orphan(): React.JSX.Element {
			useLayoutTransitionListener(listener);
			useReportLayoutTransition()(true);
			return <p>Orphan</p>;
		}

		render(<Orphan />);

		expect(listener).not.toHaveBeenCalled();
	});
});
