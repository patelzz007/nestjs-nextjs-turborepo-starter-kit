"use client";

import type { MerchantTerminalSettings } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { AlertTriangle, RotateCw, ShieldCheck } from "lucide-react";
import * as React from "react";

const REQUIRE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Turn on", loading: "Saving…" };

export interface TerminalSettingsCardProps {
	/** `undefined` until the settings load. */
	readonly settings: MerchantTerminalSettings | undefined;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onRetry: () => void;
	readonly isSaving: boolean;
	/** The last save's failure, if any. */
	readonly saveErrorMessage: string | null;
	/** Saves the new value — turning it ON is confirmed here first. */
	readonly onRequireRegisteredTerminalsChange: (requireRegisteredTerminals: boolean) => void;
}

/** Organization-wide "only registered terminals" policy. Presentational — the parent owns the query and mutation. */
export function TerminalSettingsCard({
	settings,
	isLoading,
	isError,
	onRetry,
	isSaving,
	saveErrorMessage,
	onRequireRegisteredTerminalsChange,
}: TerminalSettingsCardProps): React.JSX.Element {
	const [isConfirmOpen, setIsConfirmOpen] = React.useState<boolean>(false);

	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			if (checked) {
				setIsConfirmOpen(true);
				return;
			}
			onRequireRegisteredTerminalsChange(false);
		},
		[onRequireRegisteredTerminalsChange],
	);

	const handleConfirm = React.useCallback((): void => {
		setIsConfirmOpen(false);
		onRequireRegisteredTerminalsChange(true);
	}, [onRequireRegisteredTerminalsChange]);

	return (
		<section aria-labelledby="terminal-settings-heading" className="rounded-xl border border-border bg-card shadow-xs">
			<div className="border-b border-border px-5 py-4">
				<h2 id="terminal-settings-heading" className="text-base font-semibold text-foreground">
					Terminal security
				</h2>
				<p className="text-sm text-muted-foreground">Applies to every store in this organization.</p>
			</div>

			<div className="px-5 py-4">
				{isLoading ? (
					<div aria-label="Loading terminal settings" aria-busy="true" className="flex items-center justify-between gap-4">
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-56" />
							<Skeleton className="h-3 w-full max-w-md" />
						</div>
						<Skeleton className="h-5 w-9 rounded-full" />
					</div>
				) : isError || settings === undefined ? (
					<div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
						<AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
						<span className="text-foreground">Couldn&apos;t load the terminal settings.</span>
						<Button variant="outline" size="sm" onClick={onRetry}>
							<RotateCw className="size-4" aria-hidden="true" />
							Try again
						</Button>
					</div>
				) : (
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<p id="require-registered-terminals-label" className="text-sm font-medium text-foreground">
								Only allow registered terminals
							</p>
							<p id="require-registered-terminals-hint" className="text-sm text-muted-foreground">
								Paired tills always identify themselves. When this is on, requests made with a manually created API key must also send the{" "}
								<code className="rounded bg-muted px-1 py-0.5 text-xs">X-Terminal-Id</code> of a terminal registered here — anything else is refused.
							</p>
							{saveErrorMessage === null ? null : (
								<p role="alert" className="text-sm text-destructive">
									{saveErrorMessage}
								</p>
							)}
						</div>
						<Switch
							checked={settings.requireRegisteredTerminals}
							onCheckedChange={handleCheckedChange}
							loading={isSaving}
							disabled={isSaving}
							aria-labelledby="require-registered-terminals-label"
							aria-describedby="require-registered-terminals-hint"
						/>
					</div>
				)}
			</div>

			<AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<AlertDialogContent severity="warning" align="start" actionOrder="cancel-first" labels={REQUIRE_DIALOG_LABELS} onConfirm={handleConfirm}>
					<AlertDialogMedia severity="warning">
						<ShieldCheck aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Only allow registered terminals?</AlertDialogTitle>
					<AlertDialogDescription>
						Requests made with a manually created API key whose X-Terminal-Id isn’t a terminal registered here will be refused. Register or pair those devices first.
					</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
