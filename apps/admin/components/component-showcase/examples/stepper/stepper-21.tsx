"use client";

import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature, type ItemInstance } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { isStringPrimitive } from "@workspace/shared";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { cn } from "@workspace/ui/lib/core/utils";
import { BracesIcon, CheckIcon, DatabaseZapIcon, KeyRoundIcon, MonitorSmartphoneIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useId, useRef, useState } from "react";

/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_POSITION = 0;
const ROOT_ID = "root";
/** Ids are index paths, so 0.1.1 is Endpoint Security, Threat Detection, Suspicious Activity. */
const INITIAL_CHECK = "0.1.1";

type Severity = "High" | "Mild";
type Status = "complete" | "current" | "upcoming";

const severities: Readonly<Record<Severity, BadgeProps["variant"]>> = {
	High: "destructive-light",
	Mild: "success-light",
};

const statusLabels: Readonly<Record<Status, string>> = {
	complete: "complete",
	current: "in progress",
	upcoming: "pending",
};

interface Entry {
	readonly name: string;
	readonly icon?: React.ReactNode;
	readonly count?: number | undefined;
	readonly severity?: Severity | undefined;
	/** Nested entries, or plain check names for the leaves. */
	readonly items?: readonly (Entry | string)[] | undefined;
}

// Areas hold numbered steps and steps hold checks. The checks are what the
// stepper moves through, in this order.
const areas: readonly Entry[] = [
	{
		name: "Endpoint Security",
		icon: <MonitorSmartphoneIcon className="size-4" aria-hidden="true" />,
		items: [
			{
				name: "Inventory",
				count: 248,
				items: ["Device Discovery", "Agent Coverage", "Installed Software"],
			},
			{
				name: "Threat Detection",
				count: 12,
				items: ["Overview", "Suspicious Activity", "Malware Events", "Network Anomalies"],
			},
			{
				name: "Vulnerabilities",
				count: 37,
				severity: "High",
				items: ["Critical CVEs", "Missing Patches", "Exposed Services"],
			},
			{
				name: "Policies",
				count: 8,
				items: ["Disk Encryption", "Firewall Rules", "Screen Lock"],
			},
			{
				name: "Quarantine",
				count: 5,
				items: ["Isolated Devices", "Held Files"],
			},
			{
				name: "Response",
				count: 7,
				severity: "Mild",
				items: ["Open Incidents", "Remediation"],
			},
		],
	},
	{
		name: "Identity & Access",
		icon: <KeyRoundIcon className="size-4" aria-hidden="true" />,
		items: [
			{
				name: "Accounts",
				count: 64,
				items: ["Privileged Users", "Stale Accounts"],
			},
			{
				name: "Authentication",
				count: 9,
				severity: "High",
				items: ["MFA Coverage", "Password Policy"],
			},
		],
	},
	{
		name: "Application Security",
		icon: <BracesIcon className="size-4" aria-hidden="true" />,
		items: [
			{
				name: "Dependencies",
				count: 112,
				severity: "High",
				items: ["Known CVEs", "License Risks"],
			},
			{
				name: "Code Scanning",
				count: 23,
				items: ["Hardcoded Secrets", "Injection Flaws"],
			},
		],
	},
	{
		name: "Data Protection",
		icon: <DatabaseZapIcon className="size-4" aria-hidden="true" />,
		items: [
			{
				name: "Encryption",
				count: 4,
				items: ["Data at Rest", "Data in Transit"],
			},
			{
				name: "Backups",
				count: 3,
				severity: "Mild",
				items: ["Retention", "Restore Tests"],
			},
		],
	},
];

interface TreeNode {
	readonly name: string;
	readonly icon?: React.ReactNode;
	readonly count?: number | undefined;
	readonly severity?: Severity | undefined;
	readonly parent: string;
	readonly children?: readonly string[] | undefined;
	readonly first: number;
	readonly last: number;
}

const nodes = new Map<string, TreeNode>();
const checks: string[] = [];

function entryOf(entry: Entry | string): Entry {
	return isStringPrimitive(entry) ? { name: entry } : entry;
}

// first and last are the positions of the first and last check under a node,
// so comparing them with the active check gives any row its status.
function add(id: string, entry: Entry | string, parent: string): string {
	const { items, ...rest } = entryOf(entry);
	const first = checks.length;
	const children = items?.map((item: Entry | string, index: number): string => add(`${id}.${String(index)}`, item, id));
	if (children === undefined) checks.push(id);
	nodes.set(id, { ...rest, parent, children, first, last: checks.length - STEP_INCREMENT });
	return id;
}

const ROOT_NODE: TreeNode = {
	name: "Security review",
	parent: "",
	children: areas.map((area: Entry, index: number): string => add(String(index), area, ROOT_ID)),
	first: FIRST_POSITION,
	last: checks.length - STEP_INCREMENT,
};
nodes.set(ROOT_ID, ROOT_NODE);

const LAST_POSITION = checks.length - STEP_INCREMENT;

function nodeFor(id: string): TreeNode {
	return nodes.get(id) ?? ROOT_NODE;
}

function childrenOf(id: string): string[] {
	return [...(nodeFor(id).children ?? [])];
}

function foldersAbove(id: string): string[] {
	const parent = nodeFor(id).parent;
	return parent === ROOT_ID || parent === "" ? [] : [parent, ...foldersAbove(parent)];
}

function statusOf(node: TreeNode, progress: number): Status {
	if (node.last < progress) return "complete";
	return node.first > progress ? "upcoming" : "current";
}

function isFolder(item: ItemInstance<TreeNode>): boolean {
	return item.getItemData().children !== undefined;
}

// Rows sit flush (no pb-0.5) and each draws the guide of every indent level
// it sits under, so a guide runs unbroken down a branch and stops at its end.
// The gradient only runs left to right, so RTL mirrors the strip instead.
const guides =
	"relative not-last:pb-0 before:absolute before:inset-y-0 before:-start-1 before:w-(--tree-padding) before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))] rtl:before:-scale-x-100";

// r=7 gives a circumference of 44: the track is eleven 3+1 dashes and the
// in-progress arc is 17 long (139 degrees), offset to start at 11 o'clock as
// in the design. Only the arc spins, so the dashed track holds still.
function StatusIcon({ status }: { readonly status: Status }): React.JSX.Element {
	return (
		<span className="flex size-4.5 shrink-0 items-center justify-center">
			{status === "complete" ? (
				<span className="flex size-4 items-center justify-center rounded-full border border-success bg-success/10 text-success">
					<CheckIcon className="size-3" aria-hidden="true" />
				</span>
			) : (
				<svg viewBox="0 0 16 16" fill="none" strokeWidth="1.6" aria-hidden="true" className="size-4">
					<circle cx="8" cy="8" r="7" strokeDasharray="3 1" className="stroke-ring/50" />
					{status === "current" ? (
						<circle cx="8" cy="8" r="7" strokeDasharray="17 27" strokeDashoffset="14.4" className="origin-center stroke-success motion-safe:animate-spin" />
					) : null}
				</svg>
			)}
		</span>
	);
}

export function Stepper21Example(): React.JSX.Element {
	const labelId = useId();
	const [active, setActive] = useState<string>(INITIAL_CHECK);
	// Next on the last check finishes the review: every row then reads
	// complete, and Previous returns to that check.
	const [allDone, setAllDone] = useState<boolean>(false);
	const activeIndex = checks.indexOf(active);
	const progress = allDone ? checks.length : activeIndex;
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const activeNode = nodeFor(active);
	const step = nodeFor(activeNode.parent);

	const tree = useTree<TreeNode>({
		// Selection is pinned to the active check, so a click on a folder or a
		// multi-select gesture snaps back and only a check's primary action
		// moves it. Focusing it up front makes Tab land on it too.
		state: { selectedItems: allDone ? [] : [active] },
		initialState: {
			expandedItems: foldersAbove(active),
			focusedItem: active,
		},
		rootItemId: ROOT_ID,
		// TreeItem announces this name in place of the row's content, so it
		// carries the count, severity and status the row shows.
		getItemName: (item: ItemInstance<TreeNode>): string => {
			const node = item.getItemData();
			const parts: string[] = [node.name];
			if (node.count !== undefined) parts.push(`${String(node.count)} findings`);
			if (node.severity !== undefined) parts.push(`${node.severity} severity`);
			parts.push(statusLabels[statusOf(node, progress)]);
			return parts.join(", ");
		},
		isItemFolder: isFolder,
		onPrimaryAction: (item: ItemInstance<TreeNode>): void => {
			if (item.isFolder()) return;
			setActive(item.getId());
			setAllDone(false);
		},
		dataLoader: {
			getItem: nodeFor,
			getChildren: childrenOf,
		},
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
	});

	// Previous and Next fold the branch being left and open the new check's, so
	// the open branch follows the active check as on first render, and move the
	// tree's focus along so Tab lands on the new check.
	const goTo = useCallback(
		(index: number): void => {
			const check = checks[index];
			if (check === undefined) return;
			const path = foldersAbove(check);
			for (const id of foldersAbove(active)) {
				if (!path.includes(id)) tree.getItemInstance(id).collapse();
			}
			for (const id of path) {
				const folder = tree.getItemInstance(id);
				if (!folder.isExpanded()) folder.expand();
			}
			tree.getItemInstance(check).setFocused();
			setActive(check);
			// The pressed button disables itself at either end, so focus moves to
			// its partner.
			if (index === FIRST_POSITION) nextRef.current?.focus();
		},
		[active, tree],
	);

	// Previous stays live on the first check once the review is finished, to undo the finish.
	const previousDisabled = activeIndex === FIRST_POSITION && !allDone;

	const goToPrevious = useCallback((): void => {
		if (allDone) setAllDone(false);
		else goTo(activeIndex - STEP_INCREMENT);
	}, [activeIndex, allDone, goTo]);

	const goToNext = useCallback((): void => {
		if (activeIndex === LAST_POSITION) {
			setAllDone(true);
			prevRef.current?.focus();
		} else {
			goTo(activeIndex + STEP_INCREMENT);
		}
	}, [activeIndex, goTo]);

	// Side by side from 32rem, which leaves 12rem beside the 18rem tree for the
	// text and the Previous and Next row.
	return (
		<div className="@container w-full">
			<div className="mx-auto flex max-w-72 flex-col gap-6 @lg:max-w-none @lg:flex-row @lg:items-start">
				{/* Tree spreads getContainerProps() last, and its empty aria-label
            wins over ours, so the tree is named through aria-labelledby. */}
				<span id={labelId} className="sr-only">
					{ROOT_NODE.name}
				</span>
				<Tree tree={tree} aria-labelledby={labelId} className="@lg:w-72 @lg:shrink-0">
					{tree.getItems().map((item: ItemInstance<TreeNode>): React.JSX.Element => {
						const node = item.getItemData();
						const status = statusOf(node, progress);
						const current = status === "current";

						return (
							<TreeItem key={item.getId()} item={item} aria-current={item.getId() === active ? "step" : undefined} className={guides}>
								{/* The primitive's chevron is the first svg child and an area
                    icon the only other one, so the row tone reaches both while
                    the 14px size reaches the chevron alone. Only hover and the
                    active check fill a row; the primitive's bg-background would
                    show as a block on any other surface. */}
								<TreeItemLabel
									className={cn(
										"h-8 gap-1.5 bg-transparent font-medium not-in-data-[folder=true]:ps-2 [&>svg:first-child]:size-3.5",
										current ? "[&>svg]:text-foreground" : "[&>svg]:text-ring",
									)}>
									{node.icon ??
										(item.isFolder() ? (
											<Badge variant={status === "upcoming" ? "warning-light" : "success-light"} radius="full">
												{item.getIndexInParent() + STEP_INCREMENT}
											</Badge>
										) : (
											<StatusIcon status={status} />
										))}
									<span className={cn("truncate", !current && "text-muted-foreground")}>{node.name}</span>
									{node.count !== undefined ? <Badge variant="outline">{node.count}</Badge> : null}
									{node.severity !== undefined ? (
										<Badge variant={severities[node.severity]} className="ms-auto">
											{node.severity}
										</Badge>
									) : null}
									{node.icon !== undefined && current ? (
										<Badge variant="primary-light" className="ms-auto">
											Review
										</Badge>
									) : null}
								</TreeItemLabel>
							</TreeItem>
						);
					})}
				</Tree>

				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@lg:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @lg:block" />
				<div className="min-w-0 flex-1 px-2 @lg:px-0">
					<div role="status" className="flex flex-col gap-1">
						{allDone ? (
							<>
								<p className="text-xs text-muted-foreground">All {checks.length} checks done</p>
								<p className="text-sm font-medium">Review complete</p>
								<p className="text-sm text-muted-foreground">{ROOT_NODE.name} finished across every area</p>
							</>
						) : (
							<>
								<p className="text-xs text-muted-foreground">
									Check {activeIndex - step.first + STEP_INCREMENT} of {step.last - step.first + STEP_INCREMENT}
								</p>
								<p className="text-sm font-medium">{activeNode.name}</p>
								<p className="text-sm text-muted-foreground">
									{step.name} in {nodeFor(step.parent).name}
								</p>
							</>
						)}
					</div>
					<div className="mt-3 flex justify-start gap-2">
						<Button ref={prevRef} variant="outline" size="sm" disabled={previousDisabled} onClick={goToPrevious}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNext}>
							Next
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
