// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Empty, EmptyContent } from "../feedback/empty";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "./context-menu";
import { Drawer, DrawerContent, DrawerTrigger } from "./drawer";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

afterEach((): void => {
	cleanup();
});

// Rule 20 — ref forwarding: every component that renders a DOM element must
// forward a ref so measurement, focus management and tests can target it.
describe("overlay & feedback components forward refs (rule 20)", () => {
	it("Empty and EmptyContent forward their refs", (): void => {
		const emptyRef: { readonly current: HTMLDivElement | null } = { current: null };
		const contentRef: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Empty ref={emptyRef} data-testid="empty">
				<EmptyContent ref={contentRef} data-testid="empty-content" />
			</Empty>,
		);
		expect(emptyRef.current).toBe(screen.getByTestId("empty"));
		expect(contentRef.current).toBe(screen.getByTestId("empty-content"));
	});

	it("ContextMenuTrigger forwards its ref to the trigger div", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<ContextMenu>
				<ContextMenuTrigger ref={ref} data-testid="context-trigger">
					Right-click me
				</ContextMenuTrigger>
			</ContextMenu>,
		);
		const trigger = screen.getByTestId("context-trigger");
		expect(ref.current).toBe(trigger);
		expect(ref.current).toBeInstanceOf(HTMLDivElement);
	});

	it("ContextMenuItem forwards its ref to the item", (): void => {
		const ref: { readonly current: HTMLElement | null } = { current: null };

		render(
			<ContextMenu open>
				<ContextMenuItem ref={ref} data-testid="context-item">
					Action
				</ContextMenuItem>
			</ContextMenu>,
		);
		const item = screen.getByTestId("context-item");
		expect(ref.current).toBe(item);
	});

	it("DrawerTrigger forwards its ref to the trigger button", (): void => {
		const ref: { readonly current: HTMLButtonElement | null } = { current: null };

		render(
			<Drawer>
				<DrawerTrigger ref={ref} data-testid="drawer-trigger">
					Open
				</DrawerTrigger>
			</Drawer>,
		);
		const trigger = screen.getByTestId("drawer-trigger");
		expect(ref.current).toBe(trigger);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("DrawerContent forwards its ref to the popup", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Drawer open>
				<DrawerContent ref={ref} data-testid="drawer-content">
					Content
				</DrawerContent>
			</Drawer>,
		);
		const content = screen.getByTestId("drawer-content");
		expect(ref.current).toBe(content);
	});

	it("HoverCardTrigger forwards its ref to the trigger anchor", (): void => {
		const ref: { readonly current: HTMLAnchorElement | null } = { current: null };

		render(
			<HoverCard>
				<HoverCardTrigger ref={ref} data-testid="hover-trigger">
					Hover me
				</HoverCardTrigger>
			</HoverCard>,
		);
		const trigger = screen.getByTestId("hover-trigger");
		expect(ref.current).toBe(trigger);
	});

	it("HoverCardContent forwards its ref to the popup", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<HoverCard open>
				<HoverCardContent ref={ref} data-testid="hover-content">
					Preview
				</HoverCardContent>
			</HoverCard>,
		);
		const content = screen.getByTestId("hover-content");
		expect(ref.current).toBe(content);
	});

	it("TooltipTrigger forwards its ref to the trigger button", (): void => {
		const ref: { readonly current: HTMLButtonElement | null } = { current: null };

		render(
			<Tooltip>
				<TooltipTrigger ref={ref} data-testid="tooltip-trigger">
					Hover
				</TooltipTrigger>
			</Tooltip>,
		);
		const trigger = screen.getByTestId("tooltip-trigger");
		expect(ref.current).toBe(trigger);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("TooltipContent forwards its ref to the popup", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<Tooltip open>
				<TooltipContent ref={ref} data-testid="tooltip-content">
					Hint
				</TooltipContent>
			</Tooltip>,
		);
		const content = screen.getByTestId("tooltip-content");
		expect(ref.current).toBe(content);
	});
});
