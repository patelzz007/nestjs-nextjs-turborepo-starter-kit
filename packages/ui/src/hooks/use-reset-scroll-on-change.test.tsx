// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useResetScrollOnChange } from "./use-reset-scroll-on-change";

function Harness({ resetKey }: { readonly resetKey: string }): React.JSX.Element {
	const ref = React.useRef<HTMLDivElement>(null);
	useResetScrollOnChange(ref, resetKey);
	return (
		<div ref={ref} data-testid="scroller">
			<input aria-label="Draft" defaultValue="" />
		</div>
	);
}

afterEach((): void => {
	cleanup();
});

describe("useResetScrollOnChange", () => {
	it("scrolls back to the top when the key changes, without remounting the content", () => {
		const { rerender } = render(<Harness resetKey="/a" />);
		const scroller = screen.getByTestId("scroller");
		const input = screen.getByLabelText<HTMLInputElement>("Draft");
		input.value = "typed on page a";
		scroller.scrollTop = 400;

		rerender(<Harness resetKey="/b" />);

		expect(scroller.scrollTop).toBe(0);
		expect(screen.getByLabelText<HTMLInputElement>("Draft")).toBe(input);
		expect(input.value).toBe("typed on page a");
	});

	it("keeps the scroll position while the key is unchanged", () => {
		const { rerender } = render(<Harness resetKey="/a" />);
		const scroller = screen.getByTestId("scroller");
		scroller.scrollTop = 250;

		rerender(<Harness resetKey="/a" />);

		expect(scroller.scrollTop).toBe(250);
	});
});
