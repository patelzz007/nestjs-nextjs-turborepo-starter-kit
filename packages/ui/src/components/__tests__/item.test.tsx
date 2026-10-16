// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemFooter,
	ItemGroup,
	ItemHeader,
	ItemMedia,
	ItemSeparator,
	ItemTitle,
	type ItemSize,
	type ItemVariant,
} from "../item";

afterEach((): void => {
	cleanup();
});

describe("Item", () => {
	it("composes media, content and actions inside a list group", (): void => {
		render(
			<ItemGroup>
				<Item role="listitem">
					<ItemHeader>Header</ItemHeader>
					<ItemMedia variant="icon">*</ItemMedia>
					<ItemContent>
						<ItemTitle>Invoice #42</ItemTitle>
						<ItemDescription>Due tomorrow</ItemDescription>
					</ItemContent>
					<ItemActions>
						<button type="button">Pay</button>
					</ItemActions>
					<ItemFooter>Footer</ItemFooter>
				</Item>
				<ItemSeparator />
			</ItemGroup>,
		);
		const list = screen.getByRole("list");
		const item = screen.getByRole("listitem");
		expect(list.contains(item)).toBe(true);
		expect(item.dataset.slot).toBe("item");
		expect(item.textContent).toContain("Invoice #42");
		expect(screen.getByText("Due tomorrow").dataset.slot).toBe("item-description");
		expect(screen.getByRole("button", { name: "Pay" }).closest('[data-slot="item-actions"]')).toBeTruthy();
		expect(screen.getByText("*").dataset.variant).toBe("icon");
		expect(screen.getByRole("separator").dataset.slot).toBe("item-separator");
	});

	it.each<[ItemVariant, string]>([
		["default", "border-transparent"],
		["outline", "border-border"],
		["muted", "bg-muted/50"],
	])("styles the %s variant", (variant, expected): void => {
		render(<Item variant={variant}>Row</Item>);
		expect(screen.getByText("Row").className).toContain(expected);
	});

	it.each<[ItemSize, string]>([
		["default", "px-4"],
		["sm", "px-3"],
		["xs", "px-2.5"],
	])("pads the %s size and exposes it as data-size", (size, expected): void => {
		render(<Item size={size}>Row</Item>);
		const item = screen.getByText("Row");
		expect(item.className).toContain(expected);
		expect(item.dataset.size).toBe(size);
	});

	it("renders as a link through `render` and merges className last", (): void => {
		render(<Item render={<a href="/invoices/42">Open invoice</a>} className="px-9" />);
		const link = screen.getByRole("link", { name: "Open invoice" });
		expect(link.getAttribute("href")).toBe("/invoices/42");
		expect(link.className).toContain("px-9");
		expect(link.className).not.toContain("px-4");
	});

	it("forwards refs to the DOM nodes", (): void => {
		const itemRef = React.createRef<HTMLDivElement>();
		const groupRef = React.createRef<HTMLDivElement>();
		const descriptionRef = React.createRef<HTMLParagraphElement>();
		render(
			<ItemGroup ref={groupRef}>
				<Item ref={itemRef}>
					<ItemDescription ref={descriptionRef}>Text</ItemDescription>
				</Item>
			</ItemGroup>,
		);
		expect(itemRef.current?.dataset.slot).toBe("item");
		expect(groupRef.current?.getAttribute("role")).toBe("list");
		expect(descriptionRef.current?.tagName).toBe("P");
	});
});
