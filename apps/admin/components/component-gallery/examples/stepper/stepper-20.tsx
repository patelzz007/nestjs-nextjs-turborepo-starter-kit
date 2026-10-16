"use client";

import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature, type ItemInstance } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { cn } from "@workspace/ui/lib/core/utils";
import { BookOpenIcon, CalendarClockIcon, CheckIcon, CircleDashedIcon, EllipsisVerticalIcon, XIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useId, useRef, useState } from "react";

/** Takes an element out of the tab order (it stays pointer-only). */
const NOT_TABBABLE = -1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_POSITION = 0;
/** A single issue reads "issue"; any other count reads "issues". */
const SINGLE_ISSUE = 1;
const NO_ISSUES = 0;
/** Tree depth of the root's direct children (the orders). */
const TOP_LEVEL = 0;

type Status = "passed" | "failed" | "pending";
type OrderBadge = "Ready" | "Review";

const badges: Readonly<Record<OrderBadge, BadgeProps["variant"]>> = {
	Ready: "success-light",
	Review: "warning-light",
};

interface Check {
	readonly status: Status;
	readonly issues?: number | undefined;
}

interface Item {
	readonly status?: Status | undefined;
	readonly issues?: number | undefined;
	readonly name: string;
	readonly children?: readonly string[] | undefined;
	readonly badge?: OrderBadge | undefined;
	readonly next?: Status | undefined;
	readonly icon?: React.ReactNode;
}

/** Where a check sits in the tree: its own id, its order's and its group's. */
interface StepPath {
	readonly id: string;
	readonly orderId: string;
	readonly groupId: string;
}

const passed: Check = { status: "passed" };
const pending: Check = { status: "pending" };

function failed(issues: number): Check {
	return { status: "failed", issues };
}

// 3WIM is the three-way invoice match, the checks an order passes or fails.
// More holds plain links to what follows approval: they are not steps, so
// they carry no status and Previous and Next skip them.
const MATCH_GROUP = "3WIM";
const MORE_GROUP = "More";
const match: readonly string[] = ["Document validation", "3-way line match", "Approve payment"];
const links: readonly Item[] = [
	{
		name: "Schedule payment",
		icon: <CalendarClockIcon />,
	},
	{
		name: "Post to ledger",
		icon: <BookOpenIcon />,
	},
];

interface Order {
	readonly id: string;
	readonly checks: readonly Check[];
}

const FIRST_ORDER_ISSUES = 1;
const SECOND_CHECK_ISSUES = 2;
const LAST_ORDER_ISSUES = 3;

const orders: readonly Order[] = [
	{ id: "PO-2026-10021", checks: [failed(FIRST_ORDER_ISSUES), failed(SECOND_CHECK_ISSUES), pending] },
	{ id: "PO-2026-10001", checks: [passed, passed, passed] },
	{ id: "PO-2026-10024", checks: [passed, pending, pending] },
	{ id: "PO-2026-10032", checks: [passed, passed, pending] },
	{ id: "PO-2026-10011", checks: [pending, pending, pending] },
	{ id: "PO-2026-10033", checks: [passed, failed(LAST_ORDER_ISSUES), pending] },
];

function groupIdOf(orderId: string, group: string): string {
	return `${orderId}/${group}`;
}

function stepPathOf(orderId: string, check: string): StepPath {
	const groupId = groupIdOf(orderId, MATCH_GROUP);
	return { id: `${groupId}/${check}`, orderId, groupId };
}

/** A failed check sends the order to review; a fully passed match makes it ready to pay. */
function orderBadgeOf(checks: readonly Check[]): OrderBadge | undefined {
	if (checks.some((check: Check): boolean => check.status === "failed")) return "Review";
	return checks.every((check: Check): boolean => check.status === "passed") ? "Ready" : undefined;
}

const ROOT_ID = "root";
const items = new Map<string, Item>([[ROOT_ID, { name: "Purchase orders", children: orders.map(({ id }: Order): string => id) }]]);

// Every check in tree order, across orders: the list Previous and Next walk.
const stepPaths: StepPath[] = [];

for (const { id, checks } of orders) {
	items.set(id, { name: id, badge: orderBadgeOf(checks), children: [groupIdOf(id, MATCH_GROUP), groupIdOf(id, MORE_GROUP)] });

	const matchPaths = match.map((check: string): StepPath => stepPathOf(id, check));
	items.set(groupIdOf(id, MATCH_GROUP), { name: MATCH_GROUP, children: matchPaths.map(({ id: stepId }: StepPath): string => stepId) });
	matchPaths.forEach((path: StepPath, index: number): void => {
		stepPaths.push(path);
		const check = checks[index];
		items.set(path.id, {
			name: match[index] ?? path.id,
			status: check?.status,
			issues: check?.issues,
			next: checks[index + STEP_INCREMENT]?.status,
		});
	});

	const moreGroupId = groupIdOf(id, MORE_GROUP);
	items.set(moreGroupId, { name: MORE_GROUP, children: links.map((link: Item): string => `${moreGroupId}/${link.name}`) });
	for (const link of links) items.set(`${moreGroupId}/${link.name}`, link);
}

const LAST_POSITION = stepPaths.length - STEP_INCREMENT;
const INITIAL_PATH = stepPathOf("PO-2026-10021", "Document validation");

function itemFor(itemId: string): Item {
	return items.get(itemId) ?? { name: itemId };
}

function childrenOf(itemId: string): string[] {
	return [...(itemFor(itemId).children ?? [])];
}

function issueCount(count: number = NO_ISSUES): string {
	return `${String(count)} ${count === SINGLE_ISSUE ? "issue" : "issues"}`;
}

function note({ status, issues }: Item): string {
	if (status === "failed") return `${issueCount(issues)} to resolve before payment.`;
	return status === "passed" ? "Passed with no issues." : "Waiting to run.";
}

/** The row's accessible name: rows are named by aria-label, so it carries the badge and status too. */
function itemName(item: ItemInstance<Item>): string {
	const { name, badge, status, issues } = item.getItemData();
	const parts: string[] = [name];
	if (badge !== undefined) parts.push(badge);
	if (status !== undefined) parts.push(status === "failed" ? `failed, ${issueCount(issues)}` : status);
	return parts.join(", ");
}

function isFolder(item: ItemInstance<Item>): boolean {
	return item.getItemData().children !== undefined;
}

interface Tone {
	readonly color: string;
	readonly to: string;
	readonly icon: React.ReactNode;
}

// A tone is a text color, so the ring, the dot and the start of the
// connector below it all paint with currentColor.
const tones: Readonly<Record<Status, Tone>> = {
	passed: {
		color: "text-success",
		to: "to-success",
		icon: <CheckIcon className="size-3 text-success-foreground *:stroke-3" aria-hidden="true" />,
	},
	failed: {
		color: "text-destructive",
		to: "to-destructive",
		icon: <XIcon className="size-3 text-destructive-foreground *:stroke-3" aria-hidden="true" />,
	},
	pending: {
		color: "text-ring/80",
		to: "to-ring/80",
		icon: <CircleDashedIcon className="size-3 text-background" aria-hidden="true" />,
	},
};

// A hollow 20px ring around a 16px dot, pulled back under the group's
// chevron so the rail continues that column. In the 32px rows the connector
// is three 2px dots cut from a gradient by a centered mask (tiles in rem, like
// the box), with 1px clear of each ring. It overhangs the next row, so it ignores
// the pointer and a click there reaches that row.
function Indicator({ status, next }: { readonly status: Status; readonly next?: Status | undefined }): React.JSX.Element {
	return (
		<span aria-hidden="true" className={cn("relative -ms-4.25 flex size-5 shrink-0 items-center justify-center rounded-full border border-current", tones[status].color)}>
			<span className="flex size-4 items-center justify-center rounded-full bg-current">{tones[status].icon}</span>
			{next !== undefined ? (
				<span
					className={cn(
						"pointer-events-none absolute inset-x-0 top-5.25 mx-auto h-2.5 w-0.5 bg-linear-to-b from-current mask-[radial-gradient(circle_closest-side,#000_90%,transparent)] mask-size-[0.125rem_0.25rem] mask-center",
						tones[next].to,
					)}
				/>
			) : null}
		</span>
	);
}

const indent = 20;

// The primitive paints rows bg-background, which reads as a box on any
// other surface (a card, a dark preview), so rows stay transparent.
const label = "text-muted-foreground gap-1.5 bg-transparent px-1.5 font-medium whitespace-nowrap";

const STEP_ROW_ELEMENT = <div />;

interface StepRowProps {
	readonly item: ItemInstance<Item>;
	readonly status: Status;
	readonly className: string;
	readonly menuOpen: boolean;
	readonly onMenuOpenChange: (open: boolean) => void;
}

// A div row, so the active step can hold its actions button. That button is
// pointer-only and the tree keeps one Tab stop: the row itself opens the menu
// on Shift+F10 or the context menu key, and Enter and Space still activate
// the step.
function StepRow({ item, status, className, menuOpen, onMenuOpenChange }: StepRowProps): React.JSX.Element {
	const data = item.getItemData();
	const selected = item.isSelected();

	const handleContextMenu = useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			if (!selected) return;
			event.preventDefault();
			onMenuOpenChange(true);
		},
		[onMenuOpenChange, selected],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>): void => {
			// Keys from the portaled menu bubble here through React too.
			if (event.target !== event.currentTarget) return;
			if (selected && event.shiftKey && event.key === "F10") {
				event.preventDefault();
				onMenuOpenChange(true);
			} else if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				item.primaryAction();
			}
		},
		[item, onMenuOpenChange, selected],
	);

	const returnFocusToRow = useCallback((): HTMLElement | boolean => item.getElement() ?? true, [item]);

	return (
		<TreeItem
			item={item}
			render={STEP_ROW_ELEMENT}
			aria-current={selected ? "step" : undefined}
			aria-haspopup={selected ? "menu" : undefined}
			aria-keyshortcuts={selected ? "Shift+F10" : undefined}
			onContextMenu={handleContextMenu}
			onKeyDown={handleKeyDown}
			className={cn(className, "flex items-center gap-1")}>
			<Indicator status={status} next={data.next} />
			<TreeItemLabel className={cn(label, "me-1.5 h-8 min-w-0 flex-1 not-in-data-[folder=true]:ps-1.5")}>
				<span className="truncate">{data.name}</span>
				{data.issues !== undefined && data.issues > NO_ISSUES ? <Badge variant="destructive-light">{data.issues}</Badge> : null}
				{selected ? (
					<DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
						<DropdownMenuTrigger
							tabIndex={NOT_TABBABLE}
							aria-hidden="true"
							render={<Button variant="ghost" size="icon-xs" aria-label={`${data.name} actions`} className="ms-auto -me-1.25 text-ring" />}>
							<EllipsisVerticalIcon className="size-3.5" aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" finalFocus={returnFocusToRow} className="w-40">
							<DropdownMenuItem>Re-run step</DropdownMenuItem>
							<DropdownMenuItem>Assign reviewer</DropdownMenuItem>
							<DropdownMenuItem>Add comment</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</TreeItemLabel>
		</TreeItem>
	);
}

export function Stepper20Example(): React.JSX.Element {
	// The tree's container props set aria-label to "", so it is named by a
	// visually hidden label instead.
	const labelId = useId();
	const [active, setActive] = useState<string>(INITIAL_PATH.id);
	const [menuOpen, setMenuOpen] = useState<boolean>(false);

	// selectedItems is pinned to the active step, so the tree's multi-select
	// gestures snap back to it and only a step's primary action, Previous or
	// Next moves it.
	const tree = useTree<Item>({
		state: { selectedItems: [active] },
		initialState: {
			expandedItems: [INITIAL_PATH.orderId, INITIAL_PATH.groupId],
			focusedItem: active,
		},
		indent,
		rootItemId: ROOT_ID,
		// Rows are named by aria-label, so it carries the badge and status too.
		getItemName: itemName,
		isItemFolder: isFolder,
		onPrimaryAction: (item: ItemInstance<Item>): void => {
			// Only a check becomes the active step; a More link is plain navigation.
			if (item.getItemData().status !== undefined) setActive(item.getId());
		},
		dataLoader: {
			getItem: itemFor,
			getChildren: childrenOf,
		},
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
	});

	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const position = stepPaths.findIndex((path: StepPath): boolean => path.id === active);
	const activePath = stepPaths[position] ?? INITIAL_PATH;

	const goTo = useCallback(
		(index: number): void => {
			const path = stepPaths[index];
			if (path === undefined) return;
			setActive(path.id);
			// Open the order and group above the step and give it the tree's tab
			// stop, so Tab into the tree lands on the active step.
			for (const folder of [path.orderId, path.groupId]) {
				const instance = tree.getItemInstance(folder);
				if (!instance.isExpanded()) instance.expand();
			}
			tree.getItemInstance(path.id).setFocused();
			// The pressed button disables itself at either end, so focus moves to
			// its partner.
			if (index === FIRST_POSITION) nextRef.current?.focus();
			if (index === LAST_POSITION) prevRef.current?.focus();
		},
		[tree],
	);

	const goToPreviousStep = useCallback((): void => {
		goTo(position - STEP_INCREMENT);
	}, [goTo, position]);

	const goToNextStep = useCallback((): void => {
		goTo(position + STEP_INCREMENT);
	}, [goTo, position]);

	const steps = itemFor(activePath.groupId).children ?? [];
	const step = itemFor(active);

	// 288px, not the design's 240px: 14px step labels need room for their
	// badge and actions button. Folder labels keep their 6px padding as hover
	// bleed, and step labels end 6px early to line up with the badges. Below
	// 32rem the content stacks under the tree in the same 288px column.
	return (
		<div className="@container mx-auto w-full max-w-xl">
			<span id={labelId} className="sr-only">
				Purchase order checks
			</span>

			<div className="mx-auto flex max-w-72 flex-col gap-6 @lg:max-w-none @lg:flex-row @lg:items-start">
				<Tree indent={indent} tree={tree} aria-labelledby={labelId} className="@lg:w-72 @lg:shrink-0">
					{tree.getItems().map((item: ItemInstance<Item>): React.JSX.Element => {
						const data = item.getItemData();
						// Rows sit flush instead of 2px apart, so the guide line under an
						// order's chevron and the step connectors run unbroken.
						const row = cn(
							"not-last:pb-0",
							item.getItemMeta().level > TOP_LEVEL &&
								"relative before:absolute before:inset-y-0 before:start-3.25 before:w-px before:-translate-x-1/2 before:bg-border rtl:before:translate-x-1/2",
						);

						// A More link keeps a plain row: its icon sits in the status column,
						// so the label lines up with the checks above it.
						if (data.icon !== undefined) {
							return (
								<TreeItem key={item.getId()} item={item} className={cn(row, "flex items-center gap-1")}>
									<span aria-hidden="true" className="-ms-4.25 flex size-5 shrink-0 items-center justify-center text-ring [&_svg]:size-3.5">
										{data.icon}
									</span>
									<TreeItemLabel className={cn(label, "me-1.5 h-8 min-w-0 flex-1 not-in-data-[folder=true]:ps-1.5")}>
										<span className="truncate">{data.name}</span>
									</TreeItemLabel>
								</TreeItem>
							);
						}

						if (data.status === undefined) {
							return (
								<TreeItem key={item.getId()} item={item} className={row}>
									<TreeItemLabel className={cn(label, "h-8 in-aria-expanded:text-foreground [&>svg]:size-3.5 [&>svg]:text-ring in-aria-expanded:[&>svg]:text-current")}>
										{data.name}
										{data.badge !== undefined ? (
											<Badge variant={badges[data.badge]} className="ms-auto">
												{data.badge}
											</Badge>
										) : null}
									</TreeItemLabel>
								</TreeItem>
							);
						}

						return <StepRow key={item.getId()} item={item} status={data.status} className={row} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />;
					})}
				</Tree>

				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@lg:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @lg:block" />
				<div className="min-w-0 flex-1 px-1.5">
					<div aria-live="polite" className="flex flex-col gap-1">
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							{activePath.orderId}
							<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
							Step {steps.indexOf(active) + 1} of {steps.length}
						</p>
						<p className="text-sm font-medium">{step.name}</p>
						<p className="text-sm text-muted-foreground">{note(step)}</p>
					</div>

					<div className="mt-3 flex flex-wrap justify-start gap-2">
						<Button ref={prevRef} variant="outline" size="sm" disabled={position === FIRST_POSITION} onClick={goToPreviousStep}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={position === LAST_POSITION} onClick={goToNextStep}>
							Next
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
