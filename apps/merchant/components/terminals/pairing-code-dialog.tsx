"use client";

import { PairTerminalSnippet } from "@/components/terminals/pair-terminal-snippet";
import { formatSecondsLeft, groupPairingCode, secondsUntil } from "@/lib/terminals/terminal-summary";
import { nowEpochMs, POS_PAIRING_CODE_TTL_MS, type MerchantTerminalPairing } from "@workspace/shared";
import { CodeBlockCopyButton } from "@workspace/ui/components/code-block";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { CheckCircle2, Hourglass, Loader2, RefreshCw } from "lucide-react";
import * as React from "react";

/** The countdown re-renders once per second. */
const COUNTDOWN_TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const FULL_PERCENT = 100;
const PAIRING_CODE_TTL_SECONDS = POS_PAIRING_CODE_TTL_MS / MS_PER_SECOND;

/** The copy button names what it copies; the rest of the code-block wording comes from the app's UI kit labels. */
const PAIRING_CODE_COPY_LABELS: UiKitLabelsOverride<"codeBlock"> = { copy: "Copy pairing code", copied: "Pairing code copied" };

type PairingPhase = "waiting" | "expired" | "paired";

/** Whole seconds until `expiresAt`, re-evaluated every tick while `isTicking`. */
function useSecondsLeft(expiresAt: number, isTicking: boolean): number {
	const [now, setNow] = React.useState<number>(() => nowEpochMs());

	React.useEffect(() => {
		if (!isTicking) {
			return undefined;
		}
		const timer = window.setInterval((): void => {
			setNow(nowEpochMs());
		}, COUNTDOWN_TICK_MS);
		return (): void => {
			window.clearInterval(timer);
		};
	}, [isTicking]);

	return secondsUntil(expiresAt, now);
}

export interface PairingCodeDialogProps {
	/** The code just issued — `null` closes the dialog. */
	readonly pairing: MerchantTerminalPairing | null;
	readonly onOpenChange: (open: boolean) => void;
	/** True once the till has used this code (the parent polls the terminal list). */
	readonly isPaired: boolean;
	/** The API's public origin for the `curl` example. */
	readonly apiBaseUrl: string;
	/** Issues a replacement code once this one has expired. */
	readonly onNewCode: () => void;
	readonly isIssuingCode: boolean;
}

/** One-time pairing code with a live countdown that turns into a success state when the till pairs. Presentational. */
export function PairingCodeDialog({ pairing, onOpenChange, isPaired, apiBaseUrl, onNewCode, isIssuingCode }: PairingCodeDialogProps): React.JSX.Element {
	return (
		<Dialog open={pairing !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				{pairing === null ? null : (
					// Keyed by code, so a replacement code restarts the countdown.
					<PairingCodeContent key={pairing.pairingCode} pairing={pairing} isPaired={isPaired} apiBaseUrl={apiBaseUrl} onNewCode={onNewCode} isIssuingCode={isIssuingCode} />
				)}
			</DialogContent>
		</Dialog>
	);
}

interface PairingCodeContentProps {
	readonly pairing: MerchantTerminalPairing;
	readonly isPaired: boolean;
	readonly apiBaseUrl: string;
	readonly onNewCode: () => void;
	readonly isIssuingCode: boolean;
}

function PairingCodeContent({ pairing, isPaired, apiBaseUrl, onNewCode, isIssuingCode }: PairingCodeContentProps): React.JSX.Element {
	const terminalName = pairing.terminal.name;
	const secondsLeft = useSecondsLeft(pairing.pairingCodeExpiresAt, !isPaired);
	const phase: PairingPhase = isPaired ? "paired" : secondsLeft === 0 ? "expired" : "waiting";
	const remainingPercent = Math.min(FULL_PERCENT, (secondsLeft / PAIRING_CODE_TTL_SECONDS) * FULL_PERCENT);

	return (
		<div className="grid gap-6">
			<DialogHeader>
				<DialogTitle>{phase === "paired" ? `Paired — ${terminalName} is ready` : `Pair “${terminalName}”`}</DialogTitle>
				<DialogDescription>
					{phase === "paired"
						? `The till received its own key and can validate redemptions at ${pairing.terminal.locationName} now.`
						: "Enter this code on the till. It works once and only for this till."}
				</DialogDescription>
			</DialogHeader>

			{phase === "paired" ? (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-6 py-8 text-center motion-safe:animate-in motion-safe:fade-in-0">
					<CheckCircle2 className="size-10 text-success" aria-hidden="true" />
					<p className="text-sm text-muted-foreground">
						Terminal ID <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{pairing.terminal.terminalId}</code>
					</p>
				</div>
			) : (
				<div className="grid gap-4">
					<div className={cn("rounded-xl border px-6 py-6 text-center", phase === "expired" ? "border-border bg-muted/40" : "border-primary/30 bg-primary/5")}>
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pairing code</p>
						<div className="mt-2 flex items-center justify-center gap-2">
							<p
								className={cn(
									"font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums sm:text-4xl",
									phase === "expired" ? "text-muted-foreground line-through" : "text-foreground",
								)}>
								{groupPairingCode(pairing.pairingCode)}
							</p>
							<CodeBlockCopyButton value={pairing.pairingCode} position="inline" labels={PAIRING_CODE_COPY_LABELS} />
						</div>
						<div aria-hidden="true" className="mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear"
								style={{ width: `${String(remainingPercent)}%` }}
							/>
						</div>
						<p className="mt-2 text-sm text-muted-foreground tabular-nums">
							{phase === "expired" ? "This code can no longer be used." : `Expires in ${formatSecondsLeft(secondsLeft)}`}
						</p>
					</div>
					<PairTerminalSnippet apiBaseUrl={apiBaseUrl} pairingCode={pairing.pairingCode} />
				</div>
			)}

			{/* Announces phase changes only — never every countdown tick. */}
			<p role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-sm font-medium">
				{phase === "waiting" ? (
					<>
						<Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
						<span className="text-muted-foreground">Waiting for the till to pair…</span>
					</>
				) : phase === "expired" ? (
					<>
						<Hourglass className="size-4 text-warning" aria-hidden="true" />
						<span className="text-foreground">Code expired</span>
					</>
				) : (
					<>
						<CheckCircle2 className="size-4 text-success" aria-hidden="true" />
						<span className="text-foreground">Paired — {terminalName} is ready</span>
					</>
				)}
			</p>

			{phase === "expired" ? (
				<DialogFooter>
					<Button loading={isIssuingCode} disabled={isIssuingCode} onClick={onNewCode}>
						<RefreshCw className="size-4" aria-hidden="true" />
						New code
					</Button>
				</DialogFooter>
			) : phase === "paired" ? (
				<DialogFooter>
					<DialogClose render={<Button />}>Done</DialogClose>
				</DialogFooter>
			) : null}
		</div>
	);
}
