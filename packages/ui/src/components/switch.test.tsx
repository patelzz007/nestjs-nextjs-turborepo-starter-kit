// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Switch } from "./switch";

afterEach((): void => {
	cleanup();
});

describe("Switch", () => {
	it("forwards its ref to the switch root", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(<Switch ref={ref} />);
		expect(ref.current?.dataset.slot).toBe("switch");
	});

	it("moves the thumb by the --switch-thumb-inset token and sizes it per size", (): void => {
		const { container, rerender } = render(<Switch />);
		const thumb = (): Element | null => container.querySelector('[data-slot="switch-thumb"]');
		expect(thumb()?.className).toContain("translate-x-[calc(100%-var(--switch-thumb-inset))]");
		expect(thumb()?.className).toContain("size-(--switch-thumb-size)");

		rerender(<Switch size="sm" />);
		expect(thumb()?.className).toContain("size-(--switch-thumb-size-sm)");
	});
});
