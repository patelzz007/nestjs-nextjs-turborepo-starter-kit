// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RadioGroup, RadioGroupItem } from "./radio-group";

afterEach((): void => {
	cleanup();
});

describe("RadioGroup", () => {
	it("forwards refs on the group and its items", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLElement>();
		render(
			<RadioGroup ref={groupRef}>
				<RadioGroupItem ref={itemRef} value="a" />
			</RadioGroup>,
		);
		expect(groupRef.current?.dataset.slot).toBe("radio-group");
		expect(itemRef.current?.dataset.slot).toBe("radio-group-item");
	});

	it("sizes the item through the CVA size axis", (): void => {
		const itemRef = React.createRef<HTMLElement>();
		render(
			<RadioGroup>
				<RadioGroupItem ref={itemRef} value="a" size="lg" />
			</RadioGroup>,
		);
		expect(itemRef.current?.className).toContain("size-5");
	});

	it("applies the shared error state when aria-invalid is set", (): void => {
		const itemRef = React.createRef<HTMLElement>();
		render(
			<RadioGroup>
				<RadioGroupItem ref={itemRef} value="a" aria-invalid />
			</RadioGroup>,
		);
		expect(itemRef.current?.getAttribute("aria-invalid")).toBe("true");
		expect(itemRef.current?.className).toContain("ring-destructive/20");
	});

	it("marks data-loading and applies the loading state", (): void => {
		const itemRef = React.createRef<HTMLElement>();
		render(
			<RadioGroup>
				<RadioGroupItem ref={itemRef} value="a" loading />
			</RadioGroup>,
		);
		expect(itemRef.current?.hasAttribute("data-loading")).toBe(true);
		expect(itemRef.current?.className).toContain("opacity-60");
	});
});
