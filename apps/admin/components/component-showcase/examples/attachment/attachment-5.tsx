"use client";

import * as React from "react";
import { CheckIcon, ClockIcon, FileTextIcon, RotateCwIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@workspace/ui/components/attachment";
import { Spinner } from "@workspace/ui/components/spinner";

const ICON_QUEUED = <ClockIcon aria-hidden="true" />;

const ICON_SCANNING = <FileTextIcon aria-hidden="true" />;

const ICON_FAILED = <TriangleAlertIcon aria-hidden="true" />;

const ICON_DONE = <CheckIcon aria-hidden="true" />;

const ICON_RETRY = <RotateCwIcon aria-hidden="true" />;

const ICON_REMOVE = <XIcon aria-hidden="true" />;

// The state field is typed against the primitive's own union, so a mistyped
// state is a compile error rather than a row that quietly renders plain. The
// note is two fields because the separator between them is JSX, not data.
interface Row {
	id: string;
	name: string;
	note: string;
	detail: string;
	state: "idle" | "uploading" | "processing" | "error" | "done";
}

// One node per state, looked up rather than branched, so the row markup is
// identical across all five. The spinner is the only live element and the
// primitive sizes it from the attachment size, not from a class here.
const MEDIA: Record<Row["state"], ReactNode> = {
	idle: ICON_QUEUED,
	uploading: <Spinner />,
	processing: ICON_SCANNING,
	error: ICON_FAILED,
	done: ICON_DONE,
};

// Five rows for five states, so the whole vocabulary is on screen at once
// instead of behind a control the reader has to find first.
const QUEUE: Row[] = [
	{
		id: "terms",
		name: "annual-plan-terms.pdf",
		note: "Ready to upload",
		detail: "1.2 MB",
		state: "idle",
	},
	{
		id: "replay",
		name: "session-replay.mp4",
		note: "Uploading",
		detail: "62%",
		state: "uploading",
	},
	{
		id: "chargebacks",
		name: "chargeback-export.csv",
		note: "Scanning for card numbers",
		detail: "3.1 MB",
		state: "processing",
	},
	{
		id: "ledger",
		name: "ledger-2024.xlsx",
		note: "Failed",
		detail: "connection dropped",
		state: "error",
	},
	{
		id: "evidence",
		name: "dispute-evidence.pdf",
		note: "Uploaded",
		detail: "840 KB",
		state: "done",
	},
];

export function Attachment5Example(): React.JSX.Element {
	const [rows, setRows] = useState<Row[]>(QUEUE);

	// Counted during render instead of tracked alongside rows, so the header can
	// never disagree with the list it is counting.
	const finished = rows.filter((row) => row.state === "done").length;

	// Retry resolves straight to done. A timer would quietly animate the error
	// row away, and the error row is the one this example exists to show. The
	// failure is a dropped connection, so a second attempt plausibly succeeds.
	const retry = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { rowId } = event.currentTarget.dataset;
		setRows((current) => current.map((row) => (row.id === rowId ? { ...row, state: "done", note: "Uploaded", detail: "640 KB" } : row)));
	}, []);

	// Dismiss drops the row from state and leaves the seed untouched, so the
	// queue comes back whole when the example remounts.
	const dismiss = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { rowId } = event.currentTarget.dataset;
		setRows((current) => current.filter((row) => row.id !== rowId));
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-2">
			<p className="text-xs text-muted-foreground" aria-live="polite">
				{String(finished)} of {String(rows.length)} uploaded
			</p>
			{rows.map((row) => (
				<Attachment key={row.id} state={row.state} className="w-full">
					<AttachmentMedia>{MEDIA[row.state]}</AttachmentMedia>
					<AttachmentContent>
						{/*
						 * The uploading and processing titles animate their own highlight:
						 * that is the primitive reacting to data-state, not a per row job.
						 */}
						<AttachmentTitle>{row.name}</AttachmentTitle>
						{/*
						 * The failing row states its reason here, because the error state
						 * is otherwise carried by colour alone. The description truncates,
						 * so the same text doubles as the title for a narrow card.
						 */}
						<AttachmentDescription title={`${row.note} (${row.detail})`}>
							{row.note}
							<span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle" />
							{row.detail}
						</AttachmentDescription>
					</AttachmentContent>
					<AttachmentActions>
						{row.state === "error" ? (
							<AttachmentAction type="button" aria-label={`Retry ${row.name}`} data-row-id={row.id} onClick={retry}>
								{ICON_RETRY}
							</AttachmentAction>
						) : null}
						{/*
						 * The dismiss label changes with the state. Cancelling an upload in
						 * flight and removing a finished file are different promises.
						 */}
						<AttachmentAction
							type="button"
							aria-label={row.state === "uploading" || row.state === "processing" ? `Cancel upload of ${row.name}` : `Remove ${row.name}`}
							data-row-id={row.id}
							onClick={dismiss}>
							{ICON_REMOVE}
						</AttachmentAction>
					</AttachmentActions>
				</Attachment>
			))}
			{rows.length === 0 ? <p className="text-xs text-muted-foreground">Nothing left in the queue.</p> : null}
		</div>
	);
}
