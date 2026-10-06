// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertDialog, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "./alert-dialog";
import { CommandDialog } from "./command";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "./context-menu";
import { Dialog, DialogContent, DialogFooter } from "./dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "./drawer";
import { Empty, EmptyContent } from "./empty";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { Menubar, MenubarContent, MenubarGroup, MenubarItem, MenubarLabel, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "./menubar";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "./navigation-menu";
import { ToastCountdownLabel, ToastIcon, ToastProgress, Toaster, createToastManager, createToastMessage, toastA11yProps } from "./toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

/** Countdown-label formatter for the ToastCountdownLabel test — module scope so it is a stable reference. */
function formatSecondsLeft(seconds: number): string {
	return `${String(seconds)}s left`;
}

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
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

describe("dialog-family parts forward refs and take their copy from props", () => {
	it("AlertDialogTrigger forwards its ref to the trigger button", (): void => {
		const ref: { readonly current: HTMLButtonElement | null } = { current: null };

		render(
			<AlertDialog>
				<AlertDialogTrigger ref={ref} data-testid="alert-trigger">
					Delete
				</AlertDialogTrigger>
			</AlertDialog>,
		);
		expect(ref.current).toBe(screen.getByTestId("alert-trigger"));
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("AlertDialog header parts forward their refs", (): void => {
		const headerRef: { readonly current: HTMLDivElement | null } = { current: null };
		const mediaRef: { readonly current: HTMLDivElement | null } = { current: null };
		const titleRef: { readonly current: HTMLHeadingElement | null } = { current: null };
		const descriptionRef: { readonly current: HTMLParagraphElement | null } = { current: null };

		render(
			<AlertDialog open>
				<AlertDialogHeader ref={headerRef} data-testid="alert-header">
					<AlertDialogMedia ref={mediaRef} data-testid="alert-media" />
					<AlertDialogTitle ref={titleRef}>Delete project?</AlertDialogTitle>
					<AlertDialogDescription ref={descriptionRef}>This cannot be undone.</AlertDialogDescription>
				</AlertDialogHeader>
			</AlertDialog>,
		);
		expect(headerRef.current).toBe(screen.getByTestId("alert-header"));
		expect(mediaRef.current).toBe(screen.getByTestId("alert-media"));
		expect(titleRef.current).toBe(screen.getByText("Delete project?"));
		expect(descriptionRef.current).toBe(screen.getByText("This cannot be undone."));
	});

	it("AlertDialogMedia maps severity to its CVA tone", (): void => {
		render(<AlertDialogMedia severity="critical" data-testid="media" />);
		expect(screen.getByTestId("media").className).toContain("bg-destructive/10");
	});

	it("AlertDialogFooter forwards its ref and renders the supplied labels", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<AlertDialog open>
				<AlertDialogFooter ref={ref} data-testid="alert-footer" loadingLabel="Working" confirmLabel="Remove" cancelLabel="Keep" />
			</AlertDialog>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current).toBe(screen.getByTestId("alert-footer"));
		expect(screen.getByText("Remove")).toBeTruthy();
		expect(screen.getByText("Keep")).toBeTruthy();
	});

	it("DialogContent and DialogFooter use closeLabel for their close buttons", (): void => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogFooter showCloseButton closeLabel="Fermer le pied" />
				</DialogContent>
			</Dialog>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByText("Fermer le pied")).toBeTruthy();
		cleanup();

		render(
			<Dialog open>
				<DialogContent closeLabel="Fermer">Body</DialogContent>
			</Dialog>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByText("Fermer")).toBeTruthy();
	});

	it("CommandDialog forwards its ref to the dialog popup", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(
			<CommandDialog ref={ref} open title="Command palette" description="Search for a command">
				Palette
			</CommandDialog>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current).not.toBeNull();
		expect(ref.current?.getAttribute("data-slot")).toBe("dialog-content");
	});
});

describe("menu parts forward refs and expose CVA variants", () => {
	it("ContextMenuItem applies the destructive variant classes", (): void => {
		render(
			<ContextMenu open>
				<ContextMenuItem variant="destructive" data-testid="destructive-item">
					Delete
				</ContextMenuItem>
			</ContextMenu>,
		);
		const item = screen.getByTestId("destructive-item");
		expect(item.className).toContain("text-destructive");
		expect(item.getAttribute("data-variant")).toBe("destructive");
	});

	it("Menubar parts forward their refs", (): void => {
		const contentRef: { readonly current: HTMLDivElement | null } = { current: null };
		const groupRef: { readonly current: HTMLDivElement | null } = { current: null };
		const labelRef: { readonly current: HTMLDivElement | null } = { current: null };
		const separatorRef: { readonly current: HTMLDivElement | null } = { current: null };
		const shortcutRef: { readonly current: HTMLSpanElement | null } = { current: null };

		render(
			<Menubar>
				<MenubarMenu open>
					<MenubarTrigger>File</MenubarTrigger>
					<MenubarContent ref={contentRef} data-testid="menubar-content">
						<MenubarGroup ref={groupRef} data-testid="menubar-group">
							<MenubarLabel ref={labelRef}>Recent</MenubarLabel>
						</MenubarGroup>
						<MenubarSeparator ref={separatorRef} data-testid="menubar-separator" />
						<MenubarItem>
							Save
							<MenubarShortcut ref={shortcutRef}>⌘S</MenubarShortcut>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>,
		);
		expect(contentRef.current).toBe(screen.getByTestId("menubar-content"));
		expect(groupRef.current).toBe(screen.getByTestId("menubar-group"));
		expect(labelRef.current).toBe(screen.getByText("Recent"));
		expect(separatorRef.current).toBe(screen.getByTestId("menubar-separator"));
		expect(shortcutRef.current).toBe(screen.getByText("⌘S"));
	});

	it("NavigationMenu parts forward their refs", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const rootRef: { readonly current: HTMLElement | null } = { current: null };
		const listRef: { readonly current: HTMLUListElement | null } = { current: null };
		const itemRef: { readonly current: HTMLLIElement | null } = { current: null };
		const triggerRef: { readonly current: HTMLButtonElement | null } = { current: null };
		const linkRef: { readonly current: HTMLAnchorElement | null } = { current: null };

		render(
			<NavigationMenu ref={rootRef} data-testid="nav-root">
				<NavigationMenuList ref={listRef} data-testid="nav-list">
					<NavigationMenuItem ref={itemRef} data-testid="nav-item">
						<NavigationMenuTrigger ref={triggerRef}>Products</NavigationMenuTrigger>
					</NavigationMenuItem>
					<NavigationMenuItem>
						<NavigationMenuLink ref={linkRef} href="/docs">
							Docs
						</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>,
		);
		expect(rootRef.current).toBe(screen.getByTestId("nav-root"));
		expect(listRef.current).toBe(screen.getByTestId("nav-list"));
		expect(itemRef.current).toBe(screen.getByTestId("nav-item"));
		expect(triggerRef.current).toBe(screen.getByText("Products").closest("button"));
		expect(linkRef.current).toBe(screen.getByText("Docs"));
	});
});

describe("toast parts forward refs and take their copy from labels", () => {
	it("ToastProgress forwards its ref and clamps its value", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(<ToastProgress ref={ref} value={140} />);
		const bar = screen.getByRole("progressbar");
		expect(ref.current).toBe(bar);
		expect(bar.getAttribute("aria-valuenow")).toBe("100");
	});

	it("ToastCountdownLabel forwards its ref and sizes through the countdown token", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(<ToastCountdownLabel ref={ref} remainingMs={3200} format={formatSecondsLeft} />);
		const label = screen.getByText("4s left");
		expect(ref.current).toBe(label);
		expect(label.className).toContain("text-[length:var(--text-toast-countdown)]");
	});

	it("ToastIcon forwards its ref to the icon wrapper", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(<ToastIcon ref={ref} type="success" data-testid="toast-icon" />);
		expect(ref.current).toBe(screen.getByTestId("toast-icon"));
	});

	it("Toaster renders the supplied labels on the viewport and close button", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} labels={{ viewport: "Benachrichtigungen", close: "Schließen" }} />, { wrapper: UiKitTestProviders });
		act((): void => {
			message.info({ title: "Gespeichert" });
		});
		expect(document.querySelector("[data-slot='toast-viewport']")?.getAttribute("aria-label")).toBe("Benachrichtigungen");
		expect(document.querySelector("[data-slot='toast-close']")?.getAttribute("aria-label")).toBe("Schließen");
	});

	it("toastA11yProps takes its announcement labels from the labels object", (): void => {
		const labels = { ...UI_KIT_LABELS_EN.toast, errorAnnouncement: "Fehler" };
		expect(toastA11yProps("error", labels).label).toBe("Fehler");
		expect(toastA11yProps("info", UI_KIT_LABELS_EN.toast).label).toBe(UI_KIT_LABELS_EN.toast.notificationAnnouncement);
		expect(toastA11yProps("info", UI_KIT_LABELS_EN.toast, "Saved").label).toBe("Saved");
	});
});
