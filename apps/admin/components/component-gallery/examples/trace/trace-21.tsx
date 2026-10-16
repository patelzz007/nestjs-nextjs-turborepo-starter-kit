"use client";

import { CheckIcon, CopyIcon, ListIcon, SearchIcon, SendIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceLineStatus,
} from "@workspace/ui/components/trace";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";

const DOMAIN = "mail.northwind.dev";

interface DnsRecord {
	readonly id: string;
	readonly label: string;
	readonly type: string;
	readonly name: string;
	readonly value: string;
}

const RECORDS: readonly DnsRecord[] = [
	{
		id: "spf",
		label: "SPF",
		type: "TXT",
		name: "mail",
		value: "v=spf1 include:_spf.mailer.dev ~all",
	},
	{
		id: "dkim",
		label: "DKIM",
		type: "CNAME",
		name: "k1._domainkey.mail",
		value: "k1.dkim.mailer.dev",
	},
	{
		id: "dmarc",
		label: "DMARC",
		type: "TXT",
		name: "_dmarc.mail",
		value: "v=DMARC1; p=none; rua=mailto:dmarc@northwind.dev",
	},
];

/** The records the first DNS check finds; DMARC is still missing. */
const FIRST_CHECK_FOUND: readonly string[] = ["spf", "dkim"];
const ALL_RECORD_IDS: readonly string[] = RECORDS.map((record: DnsRecord): string => record.id);
const RECORD_COUNT = String(RECORDS.length);

/** How long a demo DNS check takes, and how long a copy's check mark stays. */
const DNS_CHECK_DURATION_MS = 1600;
const COPIED_RESET_MS = 1500;

type Phase = "checking" | "partial" | "rechecking" | "ready";

/** The phase a running check settles into; idle phases have none. */
const NEXT_PHASE: Readonly<Partial<Record<Phase, Phase>>> = {
	checking: "partial",
	rechecking: "ready",
};

function foundRecords(phase: Phase): readonly string[] {
	if (phase === "partial") {
		return FIRST_CHECK_FOUND;
	}
	return phase === "ready" ? ALL_RECORD_IDS : [];
}

function checkStatus(checking: boolean, phase: Phase): TraceLineStatus | undefined {
	if (checking) {
		return "running";
	}
	return phase === "partial" ? "error" : undefined;
}

function checkTitle(checking: boolean, verified: boolean): string {
	if (checking) {
		return "Checking DNS for the records";
	}
	return verified ? `Verified all ${RECORD_COUNT} records` : `Found ${String(FIRST_CHECK_FOUND.length)} of ${RECORD_COUNT} records, DMARC is missing`;
}

function phaseStatusText(checking: boolean, phase: Phase): string {
	if (checking) {
		return "Checking";
	}
	return phase === "partial" ? "DNS changes can take up to an hour" : "Domain verified";
}

// The records stay open beside the check that waits on them.
export function Trace21Example(): React.JSX.Element {
	const [phase, setPhase] = React.useState<Phase>("checking");
	const [copied, setCopied] = React.useState<string | null>(null);
	const statusRef = React.useRef<HTMLParagraphElement>(null);

	React.useEffect((): (() => void) | undefined => {
		const target = NEXT_PHASE[phase];
		if (target === undefined) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setPhase(target);
		}, DNS_CHECK_DURATION_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [phase]);

	React.useEffect((): (() => void) | undefined => {
		if (copied === null) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setCopied(null);
		}, COPIED_RESET_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [copied]);

	const checkAgain = React.useCallback((): void => {
		setPhase("rechecking");
		// The button disables itself, so focus moves to the status line.
		statusRef.current?.focus();
	}, []);

	const checking = phase === "checking" || phase === "rechecking";
	const verified = phase === "ready";
	const found = foundRecords(phase);
	const copiedLabel = RECORDS.find((record: DnsRecord): boolean => record.id === copied)?.label;

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<ListIcon />
							</TraceIcon>
							<TraceTitle>Add {RECORD_COUNT} records at your DNS provider</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						{/* A borderless Card is the outer frame; the table sits flush in it. */}
						<Card className="p-0">
							<CardContent className="p-0">
								<Table className="table-fixed">
									<TableHeader>
										<TableRow>
											<TableHead className="h-8 w-16">Type</TableHead>
											<TableHead className="h-8 w-28">Name</TableHead>
											<TableHead className="h-8">Value</TableHead>
											<TableHead className="h-8 w-9">
												<span className="sr-only">Copy</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{RECORDS.map((record: DnsRecord): React.JSX.Element => (
											<TableRow key={record.id}>
												<TableCell className="py-1.5">{record.type}</TableCell>
												<TableCell className="py-1.5">
													<code className="block truncate text-xs">{record.name}</code>
												</TableCell>
												<TableCell className="py-1.5" title={record.value}>
													<code className="block truncate text-xs">{record.value}</code>
												</TableCell>
												<TableCell className="py-1.5">
													<CopyRecordButton record={record} onCopied={setCopied} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status={checkStatus(checking, phase)}>
							<TraceIcon>
								<SearchIcon />
							</TraceIcon>
							<TraceTitle>{checkTitle(checking, verified)}</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{RECORDS.map((record: DnsRecord): React.JSX.Element => (
								<RecordCheckLine key={record.id} record={record} checking={checking} ok={found.includes(record.id)} />
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceLine status={verified ? undefined : "pending"}>
					<TraceIcon>
						<SendIcon />
					</TraceIcon>
					<TraceTitle>{verified ? `Ready to send from ${DOMAIN}` : `Start sending from ${DOMAIN}`}</TraceTitle>
				</TraceLine>
			</Trace>
			<div className="flex items-center gap-3">
				<Button size="sm" variant="outline" disabled={phase !== "partial"} onClick={checkAgain}>
					Check DNS again
				</Button>
				<p ref={statusRef} role="status" tabIndex={-1} className="min-w-0 text-xs text-muted-foreground outline-none">
					{phaseStatusText(checking, phase)}
				</p>
			</div>
			<p role="status" className="sr-only">
				{copiedLabel === undefined ? "" : `Copied the ${copiedLabel} value`}
			</p>
		</div>
	);
}

interface RecordCheckLineProps {
	readonly record: DnsRecord;
	readonly checking: boolean;
	readonly ok: boolean;
}

function RecordCheckLine({ record, checking, ok }: RecordCheckLineProps): React.JSX.Element {
	if (checking) {
		return (
			<TraceLine status="pending">
				<TraceTitle>Look up {record.label}</TraceTitle>
			</TraceLine>
		);
	}
	return (
		<TraceLine status={ok ? undefined : "error"}>
			<TraceTitle>{ok ? `${record.label} resolves` : `${record.label} not found on ${record.name}`}</TraceTitle>
		</TraceLine>
	);
}

interface CopyRecordButtonProps {
	readonly record: DnsRecord;
	readonly onCopied: (id: string) => void;
}

// Clipboard access is refused outside a secure context; the full value is
// still in the cell's title, so a failed copy needs no extra message.
function CopyRecordButton({ record, onCopied }: CopyRecordButtonProps): React.JSX.Element {
	const { id, value } = record;
	const handleCopied = React.useCallback((): void => {
		onCopied(id);
	}, [id, onCopied]);
	const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: COPIED_RESET_MS, onCopy: handleCopied });
	const handleClick = React.useCallback((): void => {
		copyToClipboard(value);
	}, [copyToClipboard, value]);

	return (
		<Button size="icon-xs" variant="ghost" aria-label={`Copy the ${record.label} value`} onClick={handleClick}>
			{isCopied ? <CheckIcon /> : <CopyIcon />}
		</Button>
	);
}
