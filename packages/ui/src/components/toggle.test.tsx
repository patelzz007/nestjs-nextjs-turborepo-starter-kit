// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Toggle } from "./toggle";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

afterEach((): void => {
	cleanup();
});

describe("Toggle", () => {
	it("forwards its ref to the button and marks its slot", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<Toggle ref={ref}>Bold</Toggle>);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
		expect(ref.current?.dataset.slot).toBe("toggle");
	});

	it("applies the shared error state when aria-invalid is set", (): void => {
		render(<Toggle aria-invalid>Bold</Toggle>);
		expect(screen.getByRole("button", { name: "Bold" }).className).toContain("border-destructive");
	});

	it("disables itself and marks data-loading while loading", (): void => {
		render(<Toggle loading>Bold</Toggle>);
		const toggle = screen.getByRole("button", { name: "Bold" });
		expect(toggle.hasAttribute("disabled")).toBe(true);
		expect(toggle.hasAttribute("data-loading")).toBe(true);
		expect(toggle.className).toContain("opacity-60");
	});
});

describe("ToggleGroup", () => {
	it("forwards refs on the group and its items", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLButtonElement>();
		render(
			<ToggleGroup ref={groupRef}>
				<ToggleGroupItem ref={itemRef} value="left">
					Left
				</ToggleGroupItem>
			</ToggleGroup>,
		);
		expect(groupRef.current?.dataset.slot).toBe("toggle-group");
		expect(itemRef.current?.dataset.slot).toBe("toggle-group-item");
	});

	it("exposes its spacing through the --gap custom property", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		render(
			<ToggleGroup ref={groupRef} spacing={0}>
				<ToggleGroupItem value="left">Left</ToggleGroupItem>
			</ToggleGroup>,
		);
		expect(groupRef.current?.style.getPropertyValue("--gap")).toBe("0");
		expect(groupRef.current?.dataset.spacing).toBe("0");
	});

	it("threads the group's size to every item", (): void => {
		render(
			<ToggleGroup size="sm">
				<ToggleGroupItem value="left">Left</ToggleGroupItem>
			</ToggleGroup>,
		);
		expect(screen.getByRole("button", { name: "Left" }).dataset.size).toBe("sm");
	});
});
