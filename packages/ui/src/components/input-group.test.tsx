// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";

afterEach((): void => {
	cleanup();
});

describe("InputGroupAddon", () => {
	it("focuses the group's input on pointer-down and still calls the consumer's onPointerDown", (): void => {
		const onPointerDown = vi.fn();
		render(
			<InputGroup>
				<InputGroupInput data-testid="input" />
				<InputGroupAddon data-testid="addon" onPointerDown={onPointerDown}>
					@
				</InputGroupAddon>
			</InputGroup>,
		);
		fireEvent.pointerDown(screen.getByTestId("addon"));
		expect(onPointerDown).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(screen.getByTestId("input"));
	});

	it("nudges a kbd hint through the input-group token, not an arbitrary rem", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<InputGroupAddon ref={ref} align="inline-end" />);
		expect(ref.current?.className).toContain("me-(--input-group-kbd-nudge)");
	});
});
