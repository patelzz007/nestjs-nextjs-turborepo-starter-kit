"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@workspace/ui/components/alert-dialog";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Alert, AlertAction, AlertDescription, AlertTitle, type AlertVariant } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CircleCheck, CircleX, Info, TriangleAlert, UserRoundPenIcon, type LucideIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useState } from "react";

// ── Data lives here in the smart component (rules 9/10) ─────────────────────

interface AlertDemoEntry {
	readonly variant: AlertVariant;
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
}

const alertEntries: readonly AlertDemoEntry[] = [
	{ variant: "info", icon: Info, title: "Heads up", description: "Scheduled maintenance starts at 02:00 UTC — expect brief API blips." },
	{ variant: "success", icon: CircleCheck, title: "Deploy complete", description: "v2.14.0 is live on production. 12 migrations applied cleanly." },
	{ variant: "warning", icon: TriangleAlert, title: "Storage at 82%", description: "The media bucket is filling up. Purge stale exports or bump the plan." },
	{ variant: "destructive", icon: CircleX, title: "Refresh failed", description: "The proxy could not reach the auth service. Sessions were kept as-is." },
];

const destructiveSummary: readonly { readonly label: string; readonly value: string }[] = [
	{ label: "Users", value: "12" },
	{ label: "Sessions", value: "34" },
	{ label: "Refresh tokens", value: "12" },
];

// Each dialog's own wording; every other string comes from the app's UI kit labels.
const deleteDialogLabels: UiKitLabelsOverride<"alertDialog"> = { confirm: "Delete users", loading: "Deleting…" };
const resetDialogLabels: UiKitLabelsOverride<"alertDialog"> = { confirm: "Reset database" };
const lockDialogLabels: UiKitLabelsOverride<"alertDialog"> = { confirm: "Lock account" };
const saveDialogLabels: UiKitLabelsOverride<"alertDialog"> = { confirm: "Save changes" };

export function AlertShowcase(): React.JSX.Element {
	const [dialogOpen, setDialogOpen] = useState<boolean>(false);
	const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
	const [dismissedKeys, setDismissedKeys] = useState<readonly string[]>([]);
	const [confirmationValue, setConfirmationValue] = useState<string>("");
	const [reasonValue, setReasonValue] = useState<string>("");

	const handleDismiss = useCallback((key: string): void => {
		setDismissedKeys((current) => (current.includes(key) ? current : [...current, key]));
	}, []);

	const handleEntryDismissClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const key = event.currentTarget.dataset.alertKey;
			if (key !== undefined) {
				handleDismiss(key);
			}
		},
		[handleDismiss],
	);

	// Dismissal is the parent's state: a dismissed entry is simply not rendered.
	const renderEntry = useCallback(
		(entry: AlertDemoEntry): React.JSX.Element | null => {
			if (dismissedKeys.includes(entry.variant)) {
				return null;
			}
			const Icon = entry.icon;
			return (
				<Alert key={entry.variant} variant={entry.variant} role={entry.variant === "destructive" ? "alert" : "status"}>
					<Icon aria-hidden="true" />
					<AlertTitle>{entry.title}</AlertTitle>
					<AlertDescription>{entry.description}</AlertDescription>
					<AlertAction>
						<Button type="button" variant="ghost" size="sm" data-alert-key={entry.variant} onClick={handleEntryDismissClick}>
							Dismiss
						</Button>
					</AlertAction>
				</Alert>
			);
		},
		[dismissedKeys, handleEntryDismissClick],
	);

	const handleConfirm = useCallback((): void => {
		setConfirmLoading(true);
		window.setTimeout(() => {
			setConfirmLoading(false);
			setDialogOpen(false);
		}, 1500);
	}, []);

	return (
		<div className="space-y-6">
			{/* ── Alert gallery ─────────────────────────────────────────────── */}
			<section aria-labelledby="alert-gallery-title" className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
				<h2 id="alert-gallery-title" className="text-sm font-medium">
					Alert
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">ReUI variants and composition; dismissal is page state — all data flows from this page.</p>

				<div className="mt-4 grid gap-3">{alertEntries.map(renderEntry)}</div>

				{dismissedKeys.length > 0 ? (
					<p className="mt-3 text-xs text-muted-foreground">
						Dismissed in this session: <span className="font-medium text-foreground">{dismissedKeys.join(", ") || "—"}</span>
					</p>
				) : null}

				{/* Composition without an icon, the compact size and the invert variant */}
				<div className="mt-4 grid gap-3 lg:grid-cols-2">
					<Alert variant="default" role="status">
						<AlertTitle>No icon</AlertTitle>
						<AlertDescription>The title and description take the full width when the alert has no leading icon.</AlertDescription>
					</Alert>
					<Alert variant="invert" role="status">
						<Info aria-hidden="true" />
						<AlertTitle>Invert</AlertTitle>
						<AlertDescription>High-emphasis notices in the inverted theme colours.</AlertDescription>
					</Alert>
					<Alert variant="info" size="sm" role="status">
						<Info aria-hidden="true" />
						<AlertTitle>Compact banner (size=sm)</AlertTitle>
					</Alert>
				</div>
			</section>

			{/* ── AlertDialog gallery ───────────────────────────────────────── */}
			<section aria-labelledby="alert-dialog-gallery-title" className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
				<h2 id="alert-dialog-gallery-title" className="text-sm font-medium">
					AlertDialog — confirmations
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">Severity tiers, keyword confirmation, reason gate, countdown, summary, undo hint, and async loading actions.</p>

				<div className="mt-4 flex flex-wrap gap-3">
					{/* Destructive with summary + undoHint + async loading */}
					<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<AlertDialogTrigger render={<Button variant="destructive" />}>Delete users</AlertDialogTrigger>
						<AlertDialogContent
							severity="critical"
							labels={deleteDialogLabels}
							confirmLoading={confirmLoading}
							confirmShortcut="⌘⏎"
							summary={destructiveSummary}
							undoHint="You have 5 seconds to undo after confirming."
							onConfirm={handleConfirm}
							actionOrder="cancel-first">
							<AlertDialogTitle>Delete {destructiveSummary[LIST_SLOT_INDEX.first]?.value ?? "12"} users?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently removes the selected accounts and revokes every session. <strong className="font-medium text-foreground">This cannot be undone.</strong>
							</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Keyword confirmation */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button variant="outline" />}>Type-to-confirm</AlertDialogTrigger>
						<AlertDialogContent
							severity="warning"
							labels={resetDialogLabels}
							requireConfirmation="reset staging"
							confirmationValue={confirmationValue}
							onConfirmationValueChange={setConfirmationValue}>
							<AlertDialogTitle>Reset staging database?</AlertDialogTitle>
							<AlertDialogDescription>This wipes all staging data. Type the keyword to enable the confirm button.</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Reason gate + countdown */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button variant="secondary" />}>Lock account</AlertDialogTrigger>
						<AlertDialogContent severity="warning" labels={lockDialogLabels} requireReason reasonValue={reasonValue} onReasonValueChange={setReasonValue} delaySeconds={3}>
							<AlertDialogTitle>Lock this account?</AlertDialogTitle>
							<AlertDialogDescription>The user will be signed out immediately and blocked from logging in.</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Media + form integration (feature 15) */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button />}>Edit profile</AlertDialogTrigger>
						<AlertDialogContent severity="info" labels={saveDialogLabels}>
							<AlertDialogMedia>
								<UserRoundPenIcon className="size-5" aria-hidden="true" />
							</AlertDialogMedia>
							<AlertDialogTitle>Update profile</AlertDialogTitle>
							<AlertDialogDescription>Changes apply to every signed-in session.</AlertDialogDescription>
							<div className="grid gap-3 text-start">
								<div className="grid gap-1.5">
									<Label htmlFor="alert-dialog-demo-name">Full name</Label>
									<Input id="alert-dialog-demo-name" defaultValue="Alex Rivera" />
								</div>
								<div className="grid gap-1.5">
									<Label htmlFor="alert-dialog-demo-email">Email</Label>
									<Input id="alert-dialog-demo-email" type="email" defaultValue="alex@example.com" />
								</div>
							</div>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</section>
		</div>
	);
}
