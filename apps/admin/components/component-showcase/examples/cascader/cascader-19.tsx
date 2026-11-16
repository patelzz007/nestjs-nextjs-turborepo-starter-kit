"use client";

import * as React from "react";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
	Cascader,
	CascaderContent,
	CascaderEmpty,
	CascaderList,
	CascaderPanel,
	CascaderStatus,
	CascaderTrigger,
	useCascaderSelection,
} from "@workspace/ui/components/cascader/cascader";
import { CascaderAction, CascaderFooter } from "@workspace/ui/components/cascader/cascader-footer";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderItemState } from "@workspace/ui/components/cascader/cascader-context";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";

interface Marker {
	/**
	 * The dot's fill. A literal Tailwind class, not a computed string: Tailwind
	 * only emits classes it can see in the source, so `bg-${color}-500` compiles
	 * to nothing.
	 *
	 * Each is a categorical `tone-*` token (or the muted neutral), never a raw
	 * palette step: the token already carries its own dark-theme value, so every
	 * hue keeps the same apparent weight in both themes without a `dark:` pair.
	 */
	readonly dot: string;
	readonly hint?: string;
}

const resetIcon = <RotateCcwIcon className="size-4" />;

const workflow: readonly CascaderNode<Marker>[] = [
	{
		value: "status",
		label: "Status",
		children: [
			{
				value: "status.backlog",
				label: "Backlog",
				data: { dot: "bg-muted-foreground" },
			},
			{
				value: "status.todo",
				label: "Todo",
				data: { dot: "bg-tone-blue" },
			},
			{
				value: "status.in-progress",
				label: "In progress",
				data: { dot: "bg-tone-orange" },
			},
			{
				value: "status.in-review",
				label: "In review",
				data: { dot: "bg-tone-violet" },
			},
			{
				value: "status.done",
				label: "Done",
				data: { dot: "bg-tone-green" },
			},
			{
				value: "status.cancelled",
				label: "Cancelled",
				data: { dot: "bg-muted-foreground" },
			},
		],
	},
	{
		value: "priority",
		label: "Priority",
		children: [
			{
				value: "priority.urgent",
				label: "Urgent",
				data: { dot: "bg-tone-red", hint: "Same day" },
			},
			{
				value: "priority.high",
				label: "High",
				data: { dot: "bg-tone-orange", hint: "This week" },
			},
			{
				value: "priority.medium",
				label: "Medium",
				data: { dot: "bg-tone-yellow", hint: "This sprint" },
			},
			{
				value: "priority.low",
				label: "Low",
				data: { dot: "bg-tone-teal", hint: "When it fits" },
			},
			{
				value: "priority.none",
				label: "No priority",
				data: { dot: "bg-muted-foreground" },
			},
		],
	},
	{
		value: "type",
		label: "Type",
		children: [
			{
				value: "type.feature",
				label: "Feature",
				data: { dot: "bg-tone-blue" },
			},
			{
				value: "type.bug",
				label: "Bug",
				data: { dot: "bg-tone-red" },
			},
			{
				value: "type.chore",
				label: "Chore",
				data: { dot: "bg-muted-foreground" },
			},
			{
				value: "type.docs",
				label: "Documentation",
				data: { dot: "bg-tone-teal" },
			},
		],
	},
	{
		value: "severity",
		label: "Severity",
		children: [
			{
				value: "severity.s1",
				label: "S1 - outage",
				data: { dot: "bg-tone-red" },
			},
			{
				value: "severity.s2",
				label: "S2 - degraded",
				data: { dot: "bg-tone-orange" },
			},
			{
				value: "severity.s3",
				label: "S3 - minor",
				data: { dot: "bg-tone-orange" },
			},
			{
				value: "severity.s4",
				label: "S4 - cosmetic",
				data: { dot: "bg-tone-yellow" },
			},
		],
	},
	{
		value: "effort",
		label: "Effort",
		children: [
			{
				value: "effort.xs",
				label: "XS",
				data: { dot: "bg-tone-green" },
			},
			{
				value: "effort.s",
				label: "S",
				data: { dot: "bg-tone-teal" },
			},
			{
				value: "effort.m",
				label: "M",
				data: { dot: "bg-tone-blue" },
			},
			{
				value: "effort.l",
				label: "L",
				data: { dot: "bg-tone-violet" },
			},
			{
				value: "effort.xl",
				label: "XL",
				data: { dot: "bg-tone-violet" },
			},
		],
	},
	{
		value: "stage",
		label: "Release stage",
		children: [
			{
				value: "stage.alpha",
				label: "Alpha",
				data: { dot: "bg-tone-violet" },
			},
			{
				value: "stage.beta",
				label: "Beta",
				data: { dot: "bg-tone-blue" },
			},
			{
				value: "stage.ga",
				label: "General availability",
				data: { dot: "bg-tone-green" },
			},
		],
	},
	{
		value: "risk",
		label: "Risk",
		children: [
			{
				value: "risk.blocked",
				label: "Blocked",
				data: { dot: "bg-tone-red" },
			},
			{
				value: "risk.at-risk",
				label: "At risk",
				data: { dot: "bg-tone-orange" },
			},
			{
				value: "risk.on-track",
				label: "On track",
				data: { dot: "bg-tone-green" },
			},
		],
	},
	{
		value: "confidence",
		label: "Confidence",
		children: [
			{
				value: "confidence.high",
				label: "High",
				data: { dot: "bg-tone-green" },
			},
			{
				value: "confidence.medium",
				label: "Medium",
				data: { dot: "bg-tone-yellow" },
			},
			{
				value: "confidence.low",
				label: "Low",
				data: { dot: "bg-tone-red" },
			},
		],
	},
];

/**
 * The trigger, showing the same dot the row does - so the mark that identified
 * the option in the list is the mark that identifies it once chosen.
 *
 * The three pieces sit on one row of three different natural heights: an 8px
 * dot, a 14px label, and a 12px group name. `items-center` can only centre the
 * BOXES it is given, so with each piece carrying its own font's line-height the
 * two texts came out on line boxes of 20px and 16px, the taller one dragged the
 * row's centre line down, and the dot floated visibly high of the label it
 * belongs to. Pinning one explicit `leading-4` on the row settles both texts on
 * a 16px box - `text-xs` already computes to 16px, so nothing has to fight it -
 * and from there `items-center` puts the dot's centre on the label's centre for
 * real. `shrink-0` on the dot keeps it a circle when a long label squeezes the
 * row, and `min-w-0` is what lets the label truncate instead of pushing.
 */
function WorkflowValue(): React.JSX.Element {
	const { first, firstPath, isEmpty } = useCascaderSelection<Marker>(workflow);

	if (isEmpty || first === null) {
		return <span className="text-muted-foreground">Set a field</span>;
	}

	const [group] = firstPath;

	return (
		<span className="inline-flex min-w-0 items-center gap-2 leading-4">
			<span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", first.data?.dot)} />
			<span className="min-w-0 truncate">{first.label}</span>
			<span className="truncate text-xs text-muted-foreground">{group?.label}</span>
		</span>
	);
}

/** Branch rows keep a plain label; a leaf gets its dot and its optional hint. */
function renderMarkerLabel(node: CascaderNode<Marker>, state: CascaderItemState<CascaderNode<Marker>>): React.ReactNode {
	if (state.branch) {
		return <span className="w-full truncate text-start font-medium">{node.label}</span>;
	}
	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			<span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", node.data?.dot)} />
			<span className="min-w-0 flex-1 truncate text-start">{node.label}</span>
			{node.data?.hint === undefined ? null : <span className="shrink-0 text-xs text-muted-foreground">{node.data.hint}</span>}
		</span>
	);
}

/**
 * The reset as a footer COMMAND, reading the selection out of context instead of
 * being handed it. Nothing in here is specific to this example - composed into
 * any panel it clears that cascader - and `isEmpty` is what stops it offering to
 * undo nothing.
 */
function ResetAction(): React.JSX.Element {
	const { clear, isEmpty } = useCascaderSelection();

	return (
		<CascaderAction icon={resetIcon} disabled={isEmpty} onSelect={clear}>
			Reset selection
		</CascaderAction>
	);
}

/**
 * Colour dots through `renderLabel`.
 *
 * A status or a priority is a category with no natural ordering in its name, so
 * a colour does the work an icon cannot: "In progress" and "In review" are one
 * glance apart when they are amber and violet, and three words apart when they
 * are not.
 *
 * Two rules keep it honest. The colour never carries meaning on its own - every
 * dot sits beside its written label, so the row still reads for anyone who
 * cannot separate the hues, and the dot is `aria-hidden` rather than announced
 * as a second, colour-shaped copy of the label. And each hue is declared as a
 * LITERAL class pair, `bg-tone-red`, because Tailwind only
 * emits what it can see in the source and a template string compiles to
 * nothing.
 *
 * The reset lives in the trigger, where the chevron was, and it is a SIBLING of
 * the trigger rather than a child. `CascaderTrigger` renders a real `<button>`,
 * so a button inside it would be invalid HTML, would fail the
 * `nested-interactive` axe rule, and would open the popup on its way up from
 * its own click. Positioned over the trigger's inline end it gets the same
 * picture and none of that. `showIcon` withdraws the chevron for exactly as
 * long as the reset is standing in for it so the two never stack, `pe-8` holds
 * the space the chevron used to take so the dot and its labels truncate rather
 * than run underneath, and `end-*`/`pe-*` are logical so it all mirrors in RTL.
 *
 * The same reset is then named in the footer, and the two are additive rather
 * than duplicates. The X clears in one press for someone who can already see the
 * field; the footer row is the labelled one, in front of you while the popup is
 * open and a Tab away from the search field now that the panel routes Tab past
 * the scroll area, so it is a usable surface rather than a decoration.
 * `CascaderFooter` draws the rule
 * itself, with a `border-t` that sits exactly on the boundary between the list
 * and the footer. An explicit `CascaderSeparator` in here looked equivalent and
 * was not: it stacks its own block margin on top of BOTH containers' padding,
 * which measured 12px above the rule against 6px below, where the panel's own
 * rhythm is 4px after the search field and 0 between rows. The border needs no
 * arithmetic to be symmetric, because it is the boundary rather than a child of
 * one side of it.
 */
export function Cascader19Example(): React.JSX.Element {
	const [value, setValue] = useState("");
	const hasValue = value !== "";

	const handleValueChange = useCallback((next: string): void => {
		setValue(next);
	}, []);

	const handleReset = useCallback((): void => {
		setValue("");
	}, []);

	return (
		<div className="flex w-full justify-center p-4">
			<Cascader items={workflow} value={value} onValueChange={handleValueChange} renderLabel={renderMarkerLabel}>
				<div className="relative w-72">
					<CascaderTrigger
						aria-label="Workflow field"
						showIcon={!hasValue}
						render={<Button variant="outline" className={cn("w-full justify-between gap-2 font-normal", hasValue && "pe-8")} />}>
						<WorkflowValue />
					</CascaderTrigger>

					{hasValue ? (
						<Button variant="ghost" size="icon-xs" aria-label="Reset field" onClick={handleReset} className="absolute end-1 top-1/2 -translate-y-1/2">
							<XIcon />
						</Button>
					) : null}
				</div>

				<CascaderContent className="w-72">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						<CascaderList>
							<CascaderItems />
						</CascaderList>

						{/* A SIBLING of the list, never a child of it: `CascaderList`'s own
                Enter handler clicks whatever it contains, so a command living
                inside the rows would fire on the keystroke that commits one. */}
						<CascaderFooter>
							<ResetAction />
						</CascaderFooter>

						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>
		</div>
	);
}
