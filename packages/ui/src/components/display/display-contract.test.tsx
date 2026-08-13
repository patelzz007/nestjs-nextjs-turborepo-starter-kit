// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "../feedback/badge";
import { Avatar, AvatarFallback } from "./avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../overlay/dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "../overlay/dropdown-menu";

afterEach((): void => {
	cleanup();
});

// Rule 20 — ref forwarding: every component that renders a DOM element must
// forward a ref so measurement, focus management and tests can target it.
describe("display components forward refs (rule 20)", () => {
	it("Badge forwards its ref to the rendered element", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(<Badge ref={ref}>New</Badge>);
		const badge = screen.getByText("New");
		expect(ref.current).toBe(badge);
		expect(ref.current).toBeInstanceOf(HTMLSpanElement);
	});

	it("Avatar forwards its ref to the root", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(<Avatar ref={ref} data-testid="avatar" />);
		const avatar = screen.getByTestId("avatar");
		expect(ref.current).toBe(avatar);
	});

	// AvatarImage is skipped: base-ui keeps the <img> unmounted until the image
	// actually loads, which never happens in jsdom — its ref wiring is identical
	// to AvatarFallback, which is covered above.

	it("AvatarFallback forwards its ref to the fallback", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(
			<Avatar>
				<AvatarFallback ref={ref} data-testid="avatar-fallback">
					AB
				</AvatarFallback>
			</Avatar>,
		);
		const fallback = screen.getByTestId("avatar-fallback");
		expect(ref.current).toBe(fallback);
	});

	it("Card and CardContent forward their refs", (): void => {
		const cardRef: { readonly current: HTMLDivElement | null } = { current: null };
		const contentRef: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Card ref={cardRef} data-testid="card">
				<CardContent ref={contentRef} data-testid="card-content" />
			</Card>,
		);
		expect(cardRef.current).toBe(screen.getByTestId("card"));
		expect(contentRef.current).toBe(screen.getByTestId("card-content"));
	});

	it("CardHeader and CardTitle forward their refs", (): void => {
		const headerRef: { readonly current: HTMLDivElement | null } = { current: null };
		const titleRef: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Card>
				<CardHeader ref={headerRef} data-testid="card-header">
					<CardTitle ref={titleRef} data-testid="card-title">
						Title
					</CardTitle>
				</CardHeader>
			</Card>,
		);
		expect(headerRef.current).toBe(screen.getByTestId("card-header"));
		expect(titleRef.current).toBe(screen.getByTestId("card-title"));
	});

	it("DialogContent forwards its ref to the popup", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Dialog open>
				<DialogContent ref={ref} data-testid="dialog-content">
					<DialogTitle>Title</DialogTitle>
				</DialogContent>
			</Dialog>,
		);
		const content = screen.getByTestId("dialog-content");
		expect(ref.current).toBe(content);
	});

	it("DialogTitle forwards its ref to the heading", (): void => {
		const ref: { readonly current: HTMLHeadingElement | null } = { current: null };

		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle ref={ref} data-testid="dialog-title">
						Title
					</DialogTitle>
				</DialogContent>
			</Dialog>,
		);
		const title = screen.getByTestId("dialog-title");
		expect(ref.current).toBe(title);
		expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
	});

	it("DialogTrigger forwards its ref to the trigger button", (): void => {
		const ref: { readonly current: HTMLButtonElement | null } = { current: null };

		render(
			<Dialog>
				<DialogTrigger ref={ref} data-testid="dialog-trigger">
					Open
				</DialogTrigger>
			</Dialog>,
		);
		const trigger = screen.getByTestId("dialog-trigger");
		expect(ref.current).toBe(trigger);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("DropdownMenuTrigger forwards its ref to the trigger button", (): void => {
		const ref: { readonly current: HTMLButtonElement | null } = { current: null };

		render(
			<DropdownMenu>
				<DropdownMenuTrigger ref={ref} data-testid="menu-trigger">
					Open
				</DropdownMenuTrigger>
			</DropdownMenu>,
		);
		const trigger = screen.getByTestId("menu-trigger");
		expect(ref.current).toBe(trigger);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("DropdownMenuItem forwards its ref to the item", (): void => {
		const ref: { readonly current: HTMLElement | null } = { current: null };

		render(
			<DropdownMenu open>
				<DropdownMenuItem ref={ref} data-testid="menu-item">
					Action
				</DropdownMenuItem>
			</DropdownMenu>,
		);
		const item = screen.getByTestId("menu-item");
		expect(ref.current).toBe(item);
	});
});
