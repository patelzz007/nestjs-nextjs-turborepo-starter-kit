// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { IconStack } from "../icon-stack";

afterEach((): void => {
	cleanup();
});

describe("IconStack", () => {
	it("draws three decorative layers hidden from assistive technology", (): void => {
		const { container } = render(<IconStack />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		expect(container.querySelectorAll("g")).toHaveLength(3);
		expect(container.querySelectorAll('[data-slot="icon-stack-layer"]')).toHaveLength(6);
		expect(container.querySelector('[data-slot="icon-stack-content"]')).toBeNull();
	});

	it("prints its children on the front layer", (): void => {
		render(
			<IconStack>
				<span>icon</span>
			</IconStack>,
		);
		expect(screen.getByText("icon").parentElement?.dataset.slot).toBe("icon-stack-content");
	});

	it("sets the content position custom properties and lets style override them", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		const style: React.CSSProperties = { color: "red" };
		render(<IconStack ref={ref} style={style} />);
		expect(ref.current?.style.getPropertyValue("--icon-stack-content-x")).toBe("71%");
		expect(ref.current?.style.getPropertyValue("--icon-stack-content-y")).toBe("58%");
		expect(ref.current?.style.color).toBe("red");
	});

	it("forwards its ref and merges className", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<IconStack ref={ref} className="size-24" aria-label="Empty inbox" />);
		expect(ref.current?.dataset.slot).toBe("icon-stack");
		expect(ref.current?.className).toContain("size-24");
		expect(ref.current?.className).toContain("relative");
		expect(ref.current?.getAttribute("aria-label")).toBe("Empty inbox");
	});
});
