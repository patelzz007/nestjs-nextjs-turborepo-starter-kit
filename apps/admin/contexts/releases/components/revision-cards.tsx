"use client";

import type { Revision } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import * as React from "react";

import { formatWhen, REVISION_STATUS_LABELS, REVISION_STATUS_TONES } from "../lib/release-labels";
import { ReasonActionForm } from "./reason-action-form";

export interface PendingRevisionCardProps {
	readonly revision: Revision;
	/** The rules it would put live, rendered by the page (a flag's or a config's). */
	readonly preview: React.ReactNode;
	/** The person may approve (APPROVE permission, and not its author). */
	readonly canDecide: boolean;
	readonly isOwn: boolean;
	readonly pending: boolean;
	readonly onDecide: (approve: boolean, reason: string) => Promise<void>;
}

/** A change waiting for a second person (production): what it would do, why, and approving or rejecting it. */
export function PendingRevisionCard({ revision, preview, canDecide, isOwn, pending, onDecide }: PendingRevisionCardProps): React.JSX.Element {
	const approve = React.useCallback((reason: string): Promise<void> => onDecide(true, reason), [onDecide]);
	const reject = React.useCallback((reason: string): Promise<void> => onDecide(false, reason), [onDecide]);
	return (
		<Card className="border-warning/40">
			<CardHeader>
				<CardTitle>{`Change ${String(revision.number)} is waiting for approval`}</CardTitle>
				<CardDescription>
					{`Proposed by ${revision.authorName ?? "someone"} on ${formatWhen(revision.createdAt)}: ${revision.reason}. It expires ${formatWhen(revision.expiresAt)}.`}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{preview}
				{isOwn ? (
					<p className="text-sm text-muted-foreground">Someone other than you has to approve or reject it.</p>
				) : canDecide ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<ReasonActionForm
							id={`approve-${revision.id}`}
							label="Why approve"
							submitLabel="Approve and put live"
							placeholder="e.g. Checked the rules with the team"
							pending={pending}
							onSubmit={approve}
						/>
						<ReasonActionForm
							id={`reject-${revision.id}`}
							label="Why reject"
							submitLabel="Reject"
							placeholder="e.g. Not before the release on Monday"
							destructive
							pending={pending}
							onSubmit={reject}
						/>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">You can&apos;t approve changes here.</p>
				)}
			</CardContent>
		</Card>
	);
}

/** Every revision, newest first: what happened to it, who wrote and decided it, and why. */
export function RevisionHistoryCard({ revisions }: { readonly revisions: readonly Revision[] | undefined }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>History</CardTitle>
				<CardDescription>Every saved version of the rules. A change never edits one: it adds the next.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{revisions === undefined || revisions.length === 0 ? (
					<p className="text-sm text-muted-foreground">No changes yet: the code default decides.</p>
				) : (
					<Table aria-label="Revisions">
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Why</TableHead>
								<TableHead>By</TableHead>
								<TableHead>Decided</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{revisions.map((revision): React.JSX.Element => (
								<TableRow key={revision.id}>
									<TableCell className="tabular-nums">{revision.number}</TableCell>
									<TableCell>
										<StatusBadge tone={REVISION_STATUS_TONES[revision.status]}>{REVISION_STATUS_LABELS[revision.status]}</StatusBadge>
										{revision.promotedFrom === null ? null : <p className="mt-1 text-xs text-muted-foreground">{`Promoted from ${revision.promotedFrom}`}</p>}
									</TableCell>
									<TableCell className="max-w-md">{revision.reason}</TableCell>
									<TableCell className="whitespace-nowrap">
										{revision.authorName ?? "—"}
										<p className="text-xs text-muted-foreground">{formatWhen(revision.createdAt)}</p>
									</TableCell>
									<TableCell className="whitespace-nowrap">
										{revision.decidedByName ?? "—"}
										<p className="text-xs text-muted-foreground">{formatWhen(revision.decidedAt)}</p>
										{revision.decisionReason === null ? null : <p className="text-xs text-muted-foreground">{revision.decisionReason}</p>}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
