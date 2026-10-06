"use client";

import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { describeTerminalStatus, pairingActionLabel, type TerminalStatusTone } from "@/lib/terminals/terminal-summary";
import { PLATFORM_DISPLAY_REGION, type MerchantTerminalSummary } from "@workspace/shared";
import { CodeBlockCopyButton } from "@workspace/ui/components/code-block";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { AlertTriangle, Clock, MapPin, MonitorSmartphone, Plus, RotateCw } from "lucide-react";
import * as React from "react";

/** Column layout shared by the header and every row (stacked below `lg`). */
const ROW_GRID = "grid gap-3 px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] lg:items-center lg:gap-4";

/** Rows shown while the first page loads (matches a typical small fleet of tills). */
const SKELETON_ROWS = 3;

const TONE_TEXT: Readonly<Record<TerminalStatusTone, string>> = {
	success: "text-success",
	warning: "text-warning",
	muted: "text-muted-foreground",
};

const TONE_DOT: Readonly<Record<TerminalStatusTone, string>> = {
	success: "bg-success",
	warning: "bg-warning",
	muted: "bg-muted-foreground",
};

const TONE_TILE: Readonly<Record<TerminalStatusTone, string>> = {
	success: "border-primary/20 bg-primary/10 text-primary",
	warning: "border-warning/30 bg-warning/10 text-warning",
	muted: "border-border bg-muted text-muted-foreground",
};

export interface TerminalListProps {
	readonly terminals: readonly MerchantTerminalSummary[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onRetry: () => void;
	/** Opens the add-terminal dialog (the empty state's call to action). */
	readonly onAddRequest: () => void;
	/** The terminal whose new pairing code is being issued (its button shows progress). */
	readonly pairingTerminalId: string | null;
	/** The terminal whose removal is in flight. */
	readonly removingTerminalId: string | null;
	/** Asks for a new pairing code (the parent confirms first for an active till). */
	readonly onPairRequest: (terminal: MerchantTerminalSummary) => void;
	/** Asks to remove a till (the parent confirms first). */
	readonly onRemoveRequest: (terminal: MerchantTerminalSummary) => void;
	/** "Showing the newest N of M terminals." — when one page doesn't hold them all. */
	readonly truncationNote: string | null;
}

/** Registered tills with their status, store and last activity, plus loading, error and empty states. Presentational. */
export function TerminalList({
	terminals,
	isLoading,
	isError,
	onRetry,
	onAddRequest,
	pairingTerminalId,
	removingTerminalId,
	onPairRequest,
	onRemoveRequest,
	truncationNote,
}: TerminalListProps): React.JSX.Element {
	const showColumnHeader = !isLoading && !isError && terminals.length > 0;

	return (
		<section aria-labelledby="terminal-list-heading" className="rounded-xl border border-border bg-card shadow-xs">
			<div className="border-b border-border px-5 py-4">
				<h2 id="terminal-list-heading" className="text-base font-semibold text-foreground">
					Registered terminals
				</h2>
				<p className="text-sm text-muted-foreground">Each till pairs once with a one-time code and then authenticates with its own key.</p>
			</div>

			{truncationNote === null ? null : <p className="border-b border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">{truncationNote}</p>}

			{showColumnHeader ? (
				<div
					aria-hidden="true"
					className={cn(ROW_GRID, "hidden border-b border-border bg-muted/40 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid")}>
					<span>Terminal</span>
					<span>Terminal ID</span>
					<span>Store</span>
					<span>Last seen</span>
					<span />
				</div>
			) : null}

			<div>
				{isLoading ? (
					<ul aria-label="Loading terminals" aria-busy="true" className="space-y-2 p-3">
						{Array.from({ length: SKELETON_ROWS }, (_, index: number) => (
							<li key={index} className="flex items-center gap-3 rounded-lg px-3 py-3">
								<Skeleton className="size-10 rounded-lg" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-64" />
								</div>
							</li>
						))}
					</ul>
				) : isError ? (
					<div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
						<AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
						<p className="text-sm text-foreground">Couldn&apos;t load your terminals.</p>
						<Button variant="outline" size="sm" onClick={onRetry}>
							<RotateCw className="size-4" aria-hidden="true" />
							Try again
						</Button>
					</div>
				) : terminals.length === 0 ? (
					<MerchantEmptyState
						className="border-0 bg-transparent py-12"
						icon={<MonitorSmartphone className="size-5" aria-hidden="true" />}
						title="No terminals yet"
						description="Add a till to get a one-time pairing code. The till enters it once and is ready to validate redemptions."
						action={
							<Button onClick={onAddRequest}>
								<Plus className="size-4" aria-hidden="true" />
								Add your first terminal
							</Button>
						}
					/>
				) : (
					<ul className="divide-y divide-border" aria-label="Terminals">
						{terminals.map((terminal: MerchantTerminalSummary): React.JSX.Element => (
							<TerminalRow
								key={terminal.id}
								terminal={terminal}
								isIssuingCode={pairingTerminalId === terminal.id}
								isRemoving={removingTerminalId === terminal.id}
								onPairRequest={onPairRequest}
								onRemoveRequest={onRemoveRequest}
							/>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

interface TerminalRowProps {
	readonly terminal: MerchantTerminalSummary;
	readonly isIssuingCode: boolean;
	readonly isRemoving: boolean;
	readonly onPairRequest: (terminal: MerchantTerminalSummary) => void;
	readonly onRemoveRequest: (terminal: MerchantTerminalSummary) => void;
}

function TerminalRow({ terminal, isIssuingCode, isRemoving, onPairRequest, onRemoveRequest }: TerminalRowProps): React.JSX.Element {
	const status = describeTerminalStatus(terminal.status);
	const pairLabel = pairingActionLabel(terminal.status);
	const isBusy = isIssuingCode || isRemoving;
	const copyIdLabels = React.useMemo(
		(): UiKitLabelsOverride<"codeBlock"> => ({ copy: `Copy terminal ID of ${terminal.name}`, copied: `Copied terminal ID of ${terminal.name}` }),
		[terminal.name],
	);

	const handlePair = React.useCallback((): void => {
		onPairRequest(terminal);
	}, [onPairRequest, terminal]);

	const handleRemove = React.useCallback((): void => {
		onRemoveRequest(terminal);
	}, [onRemoveRequest, terminal]);

	return (
		<li className={cn(ROW_GRID, "py-4 transition-colors hover:bg-muted/30 motion-reduce:transition-none")}>
			<div className="flex min-w-0 items-center gap-3">
				<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border", TONE_TILE[status.tone])}>
					<MonitorSmartphone className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<p className="truncate font-medium text-foreground">{terminal.name}</p>
					<span className={cn("mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium", TONE_TEXT[status.tone])}>
						<span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[status.tone])} />
						{status.label}
					</span>
				</div>
			</div>
			<div className="flex min-w-0 items-center gap-1">
				<span className="text-sm text-muted-foreground lg:sr-only">Terminal ID: </span>
				<code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{terminal.terminalId}</code>
				<CodeBlockCopyButton value={terminal.terminalId} position="inline" labels={copyIdLabels} />
			</div>
			<p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
				<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="lg:sr-only">Store: </span>
				<span className="truncate">{terminal.locationName}</span>
			</p>
			<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Clock className="size-3.5 shrink-0 lg:hidden" aria-hidden="true" />
				<span className="lg:sr-only">Last seen </span>
				{terminal.lastSeenAt === null ? "Never" : <RelativeTime epochMs={terminal.lastSeenAt} region={PLATFORM_DISPLAY_REGION} />}
			</p>
			<div className="flex flex-wrap gap-2 lg:justify-end">
				<Button size="sm" variant="outline" loading={isIssuingCode} disabled={isBusy} onClick={handlePair} aria-label={`${pairLabel} for ${terminal.name}`}>
					{pairLabel}
				</Button>
				<Button size="sm" variant="ghost" loading={isRemoving} disabled={isBusy} onClick={handleRemove} aria-label={`Remove ${terminal.name}`}>
					Remove
				</Button>
			</div>
		</li>
	);
}
