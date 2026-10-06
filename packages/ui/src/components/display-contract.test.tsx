// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Avatar, AvatarFallback } from "./avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { AspectRatio } from "./aspect-ratio";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
	AttachmentTrigger,
} from "./attachment";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "./bubble";
import { Marker, MarkerContent, MarkerIcon } from "./marker";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "./message-scroller";
import { QrCode } from "./qr-code";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

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
			{ wrapper: UiKitTestProviders },
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
			{ wrapper: UiKitTestProviders },
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

describe("layout, chat and marker parts forward refs (rule 20)", () => {
	it("AspectRatio forwards its ref and keeps the caller's style alongside the ratio", (): void => {
		const ref = React.createRef<HTMLDivElement>();

		render(<AspectRatio ref={ref} ratio={2} style={{ maxWidth: "10rem" }} data-testid="ratio" />);
		const node = screen.getByTestId("ratio");
		expect(ref.current).toBe(node);
		expect(node.style.getPropertyValue("--ratio")).toBe("2");
		expect(node.style.maxWidth).toBe("10rem");
	});

	it("Marker, MarkerIcon and MarkerContent forward their refs", (): void => {
		const markerRef = React.createRef<HTMLDivElement>();
		const iconRef = React.createRef<HTMLSpanElement>();
		const contentRef = React.createRef<HTMLSpanElement>();

		render(
			<Marker ref={markerRef} variant="separator" data-testid="marker">
				<MarkerIcon ref={iconRef} data-testid="marker-icon" />
				<MarkerContent ref={contentRef} data-testid="marker-content">
					Today
				</MarkerContent>
			</Marker>,
		);
		expect(markerRef.current).toBe(screen.getByTestId("marker"));
		expect(markerRef.current?.className).toContain("before:bg-border");
		expect(iconRef.current).toBe(screen.getByTestId("marker-icon"));
		expect(contentRef.current).toBe(screen.getByTestId("marker-content"));
	});

	it("BubbleGroup, Bubble, BubbleContent and BubbleReactions forward their refs", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		const bubbleRef = React.createRef<HTMLDivElement>();
		const contentRef = React.createRef<HTMLDivElement>();
		const reactionsRef = React.createRef<HTMLDivElement>();

		render(
			<BubbleGroup ref={groupRef} data-testid="bubble-group">
				<Bubble ref={bubbleRef} data-testid="bubble">
					<BubbleContent ref={contentRef} data-testid="bubble-content">
						Hello
					</BubbleContent>
					<BubbleReactions ref={reactionsRef} data-testid="bubble-reactions" />
				</Bubble>
			</BubbleGroup>,
		);
		expect(groupRef.current).toBe(screen.getByTestId("bubble-group"));
		expect(bubbleRef.current).toBe(screen.getByTestId("bubble"));
		expect(contentRef.current).toBe(screen.getByTestId("bubble-content"));
		expect(reactionsRef.current).toBe(screen.getByTestId("bubble-reactions"));
	});

	it("caps a bubble at four fifths of the row on the spacing scale", (): void => {
		render(<Bubble data-testid="bubble" />);
		expect(screen.getByTestId("bubble").className).toContain("max-w-4/5");
	});

	it("every Attachment part forwards its ref", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const groupRef = React.createRef<HTMLDivElement>();
		const mediaRef = React.createRef<HTMLDivElement>();
		const contentRef = React.createRef<HTMLDivElement>();
		const titleRef = React.createRef<HTMLSpanElement>();
		const descriptionRef = React.createRef<HTMLSpanElement>();
		const actionsRef = React.createRef<HTMLDivElement>();
		const actionRef = React.createRef<HTMLElement>();
		const triggerRef = React.createRef<HTMLButtonElement>();

		render(
			<AttachmentGroup ref={groupRef} data-testid="attachment-group">
				<Attachment ref={rootRef} state="uploading" data-testid="attachment">
					<AttachmentMedia ref={mediaRef} data-testid="attachment-media" />
					<AttachmentContent ref={contentRef} data-testid="attachment-content">
						<AttachmentTitle ref={titleRef} data-testid="attachment-title">
							report.pdf
						</AttachmentTitle>
						<AttachmentDescription ref={descriptionRef} data-testid="attachment-description">
							2 MB
						</AttachmentDescription>
					</AttachmentContent>
					<AttachmentActions ref={actionsRef} data-testid="attachment-actions">
						<AttachmentAction ref={actionRef} aria-label="Remove" data-testid="attachment-action" />
					</AttachmentActions>
					<AttachmentTrigger ref={triggerRef} aria-label="Open" data-testid="attachment-trigger" />
				</Attachment>
			</AttachmentGroup>,
		);
		expect(groupRef.current).toBe(screen.getByTestId("attachment-group"));
		expect(rootRef.current).toBe(screen.getByTestId("attachment"));
		expect(rootRef.current?.dataset.state).toBe("uploading");
		expect(mediaRef.current).toBe(screen.getByTestId("attachment-media"));
		expect(contentRef.current).toBe(screen.getByTestId("attachment-content"));
		expect(titleRef.current).toBe(screen.getByTestId("attachment-title"));
		expect(descriptionRef.current).toBe(screen.getByTestId("attachment-description"));
		expect(actionsRef.current).toBe(screen.getByTestId("attachment-actions"));
		expect(actionRef.current).toBe(screen.getByTestId("attachment-action"));
		expect(triggerRef.current).toBe(screen.getByTestId("attachment-trigger"));
		expect(triggerRef.current?.getAttribute("type")).toBe("button");
	});

	it("message-scroller parts forward their refs and the jump button is named by the caller", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const viewportRef = React.createRef<HTMLDivElement>();
		const contentRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLDivElement>();
		const buttonRef = React.createRef<HTMLButtonElement>();

		render(
			<MessageScrollerProvider>
				<MessageScroller ref={rootRef} data-testid="scroller">
					<MessageScrollerViewport ref={viewportRef} data-testid="scroller-viewport">
						<MessageScrollerContent ref={contentRef} data-testid="scroller-content">
							<MessageScrollerItem ref={itemRef} messageId="m1" data-testid="scroller-item">
								Hi
							</MessageScrollerItem>
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton ref={buttonRef} label="Jump to latest message" />
				</MessageScroller>
			</MessageScrollerProvider>,
		);
		expect(rootRef.current).toBe(screen.getByTestId("scroller"));
		expect(viewportRef.current).toBe(screen.getByTestId("scroller-viewport"));
		expect(contentRef.current).toBe(screen.getByTestId("scroller-content"));
		expect(itemRef.current).toBe(screen.getByTestId("scroller-item"));
		expect(buttonRef.current?.getAttribute("aria-label")).toBe("Jump to latest message");
	});
});

describe("size variants route through CVA (rule 23)", () => {
	it("Avatar sizes its root from the size variant and keeps data-size for its parts", (): void => {
		render(<Avatar size="lg" data-testid="avatar" />);
		const avatar = screen.getByTestId("avatar");
		expect(avatar.className).toContain("size-10");
		expect(avatar.dataset.size).toBe("lg");
	});

	it("Card sets its spacing variable from the size variant", (): void => {
		render(<Card size="sm" data-testid="card" />);
		expect(screen.getByTestId("card").className).toContain("[--card-spacing:--spacing(4)]");
	});
});

describe("QrCode", () => {
	it("is named by the caller's label and drawn in the QR tokens, not raw colours", (): void => {
		const { container } = render(<QrCode value="reward:123" label="Reward redemption QR code" data-testid="qr" />);
		const frame = screen.getByRole("img", { name: "Reward redemption QR code" });
		expect(frame.className).toContain("bg-qr-background");
		expect(frame.className).toContain("text-qr-foreground");
		expect(frame.className).not.toContain("bg-white");
		const fills = [...container.querySelectorAll("path")].map((path) => path.getAttribute("fill"));
		expect(fills).toContain("currentColor");
		expect(fills.some((fill) => fill?.startsWith("#") ?? false)).toBe(false);
	});

	it("forwards its ref to the frame", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<QrCode ref={ref} value="reward:123" label="QR" />);
		expect(ref.current).toBe(screen.getByRole("img", { name: "QR" }));
	});
});
