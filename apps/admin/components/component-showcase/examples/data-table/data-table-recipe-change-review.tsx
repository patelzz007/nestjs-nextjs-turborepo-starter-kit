"use client";

import { Check, X } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import {
	DataTable,
	type DataTableColumns,
	type DataTableDetail,
	type DataTableHeading,
	type DataTableRowAction,
	type DataTableRowStatus,
} from "@workspace/ui/components/data-table";

type ChangeKind = "added" | "changed" | "removed";
type Decision = "pending" | "approved" | "rejected";

/** One proposed change to a pricing configuration, waiting for review. */
interface ProposedChange {
	readonly id: string;
	readonly key: string;
	readonly kind: ChangeKind;
	/** The value before the change; absent for an added key. */
	readonly before?: string;
	/** The value after the change; absent for a removed key. */
	readonly after?: string;
	readonly author: string;
	readonly decision: Decision;
}

export const CHANGES: readonly ProposedChange[] = [
	{ id: "c-1", key: "plans.team.price", kind: "changed", before: "USD 12", after: "USD 14", author: "Aisha Rahman", decision: "pending" },
	{ id: "c-2", key: "plans.team.seats", kind: "changed", before: "10", after: "20", author: "Aisha Rahman", decision: "pending" },
	{ id: "c-3", key: "plans.business.sso", kind: "added", after: "true", author: "Ben Ortega", decision: "pending" },
	{ id: "c-4", key: "plans.starter.trialDays", kind: "removed", before: "30", author: "Ben Ortega", decision: "pending" },
	{ id: "c-5", key: "currency.default", kind: "changed", before: "USD", after: "MYR", author: "Chen Wei", decision: "pending" },
];

/** The row mark the table draws for each kind of change: new, edited, or struck through. */
const ROW_STATUS: Readonly<Record<ChangeKind, DataTableRowStatus>> = { added: "new", changed: "dirty", removed: "deleted" };

export function changeRowStatus(change: ProposedChange): DataTableRowStatus {
	return ROW_STATUS[change.kind];
}

/** The changes with one decided. A pure step, so it is testable. */
export function decide(changes: readonly ProposedChange[], id: string, decision: Decision): ProposedChange[] {
	return changes.map((change): ProposedChange => (change.id === id ? { ...change, decision } : change));
}

/** How many changes are still waiting. */
export function pendingCount(changes: readonly ProposedChange[]): number {
	return changes.filter((change) => change.decision === "pending").length;
}

const DECISION_BADGE: Readonly<Record<Decision, { readonly label: string; readonly variant: "warning-light" | "success-light" | "destructive-light" }>> = {
	pending: { label: "Pending", variant: "warning-light" },
	approved: { label: "Approved", variant: "success-light" },
	rejected: { label: "Rejected", variant: "destructive-light" },
};

const KIND_LABEL: Readonly<Record<ChangeKind, string>> = { added: "Added", changed: "Changed", removed: "Removed" };

const COLUMNS: DataTableColumns<ProposedChange> = [
	{ accessorKey: "key", header: "Setting", size: 230, meta: { cellClassName: "font-mono text-xs" } },
	{ accessorKey: "kind", header: "Change", size: 110, cell: ({ row }): string => KIND_LABEL[row.original.kind] },
	{ accessorKey: "author", header: "Proposed by", size: 150 },
	{
		accessorKey: "decision",
		header: "Review",
		size: 120,
		cell: ({ row }): React.JSX.Element => {
			const badge = DECISION_BADGE[row.original.decision];
			return <Badge variant={badge.variant}>{badge.label}</Badge>;
		},
	},
];

function ValueBlock({ label, value, tone }: { readonly label: string; readonly value: string | undefined; readonly tone: "before" | "after" }): React.JSX.Element {
	return (
		<div className="grid gap-1">
			<span className="text-xs text-muted-foreground">{label}</span>
			<code className={tone === "before" ? "rounded-md bg-destructive-soft px-2 py-1 text-destructive" : "rounded-md bg-success-soft px-2 py-1 text-success-foreground"}>
				{value ?? "(not set)"}
			</code>
		</div>
	);
}

function renderChangePanel(change: ProposedChange): React.JSX.Element {
	return (
		<div className="grid gap-4 text-sm">
			<ValueBlock label="Before" value={change.before} tone="before" />
			<ValueBlock label="After" value={change.after} tone="after" />
			<p className="text-muted-foreground">Proposed by {change.author}.</p>
		</div>
	);
}

/** The panel's heading for a change. */
export function changePanelTitle(change: ProposedChange): string {
	return change.key;
}

const DETAIL: DataTableDetail<ProposedChange> = { mode: "panel", render: renderChangePanel, title: changePanelTitle, hideColumnsWhileOpen: ["author"] };

function getChangeId(change: ProposedChange): string {
	return change.id;
}

function isPending(change: ProposedChange): boolean {
	return change.decision === "pending";
}

/**
 * Recipe: reviewing a change set. Each row is marked by `rowStatus` as added (new), changed (dirty) or removed
 * (struck through); clicking it shows the before and after in the side panel. Approve and Reject sit in the row while
 * the change is pending.
 */
export function DataTableRecipeChangeReview(): React.JSX.Element {
	const [changes, setChanges] = React.useState<readonly ProposedChange[]>(CHANGES);

	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<ProposedChange>[] => [
			{
				key: "approve",
				label: "Approve",
				description: "Accept the change as proposed",
				icon: <Check aria-hidden="true" />,
				inline: true,
				isAvailable: isPending,
				onSelect: (change: ProposedChange): void => {
					setChanges((current) => decide(current, change.id, "approved"));
				},
			},
			{
				key: "reject",
				label: "Reject",
				description: "Turn the change down",
				icon: <X aria-hidden="true" />,
				tone: "destructive",
				isAvailable: isPending,
				onSelect: (change: ProposedChange): void => {
					setChanges((current) => decide(current, change.id, "rejected"));
				},
			},
		],
		[],
	);

	const waiting = pendingCount(changes);
	const heading = React.useMemo(
		(): DataTableHeading => ({ title: "Pricing changes", description: waiting === 0 ? "Every change is reviewed." : `${String(waiting)} waiting for review.` }),
		[waiting],
	);

	return <DataTable data={changes} columns={COLUMNS} getRowId={getChangeId} rowStatus={changeRowStatus} detail={DETAIL} rowActions={rowActions} heading={heading} />;
}
