"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@workspace/ui/components/alert-dialog";
import { Alert, AlertAction } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { UserRoundPenIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useState } from "react";

// ── Data lives here in the smart component (rules 9/10) ─────────────────────

interface AlertDemoEntry {
	readonly variant: "default" | "success" | "warning" | "destructive" | "info";
	readonly title: string;
	readonly description: string;
}

const alertEntries: readonly AlertDemoEntry[] = [
	{ variant: "info", title: "Heads up", description: "Scheduled maintenance starts at 02:00 UTC — expect brief API blips." },
	{ variant: "success", title: "Deploy complete", description: "v2.14.0 is live on production. 12 migrations applied cleanly." },
	{ variant: "warning", title: "Storage at 82%", description: "The media bucket is filling up. Purge stale exports or bump the plan." },
	{ variant: "destructive", title: "Refresh failed", description: "The proxy could not reach the auth service. Sessions were kept as-is." },
];

const destructiveSummary: readonly { readonly label: string; readonly value: string }[] = [
	{ label: "Users", value: "12" },
	{ label: "Sessions", value: "34" },
	{ label: "Refresh tokens", value: "12" },
];

export function AlertShowcase(): React.JSX.Element {
	const [dialogOpen, setDialogOpen] = useState<boolean>(false);
	const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
	const [dismissedKeys, setDismissedKeys] = useState<readonly string[]>([]);

	const handleDismiss = useCallback((key: string): void => {
		setDismissedKeys((current) => (current.includes(key) ? current : [...current, key]));
	}, []);

	const handleEntryDismiss = useCallback(
		(entry: AlertDemoEntry): void => {
			handleDismiss(entry.variant);
		},
		[handleDismiss],
	);

	const renderEntry = useCallback(
		(entry: AlertDemoEntry): React.JSX.Element => {
			return (
				<Alert
					key={entry.variant}
					variant={entry.variant}
					title={entry.title}
					description={entry.description}
					dismissible
					onDismiss={function (): void {
						handleEntryDismiss(entry);
					}}
				/>
			);
		},
		[handleEntryDismiss],
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
					Alert &amp; AlertBox
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">Variants, dismissible, collapsible, progress, copy-details and error lists — all data flows from this page.</p>

				<div className="mt-4 grid gap-3">{alertEntries.map(renderEntry)}</div>

				{dismissedKeys.length > 0 ? (
					<p className="mt-3 text-xs text-muted-foreground">
						Dismissed in this session: <span className="font-medium text-foreground">{dismissedKeys.join(", ") || "—"}</span>
					</p>
				) : null}

				{/* Collapsible + progress + copy-details + errors demo */}
				<div className="mt-4 grid gap-3 lg:grid-cols-2">
					<Alert
						variant="warning"
						collapsible
						defaultOpen
						title="Deployment checklist"
						description="Three steps still need attention before the release window opens."
						errors={["Staging env parity differs on NEXT_PUBLIC_SESSION_POLL_MS", "CDN purge queue has 2 stale routes", "Backup verification has not run this week"]}
					/>
					<Alert
						variant="success"
						title="Upload in progress"
						description="media/live-demo.mp4 is uploading…"
						progress={64}
						countdown="2m 11s left"
						details='{"file":"media/live-demo.mp4","bytes":48239111,"progress":64}'
					/>
				</div>

				{/* Small / interactive / print-hidden variants */}
				<div className="mt-4 flex flex-wrap gap-2">
					<Alert size="sm" variant="info" title="Compact banner (size=sm)" className="min-w-56 flex-1" />
					<Alert interactive variant="default" title="Interactive — hover lifts the tile" className="min-w-56 flex-1">
						<AlertAction>Inspect</AlertAction>
					</Alert>
					<Alert printHidden variant="info" title="Hidden when printing" className="min-w-56 flex-1" />
				</div>
			</section>

			{/* ── AlertDialog gallery ───────────────────────────────────────── */}
			<section aria-labelledby="alert-dialog-gallery-title" className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
				<h2 id="alert-dialog-gallery-title" className="text-sm font-medium">
					AlertDialog — confirmations
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">Severity tiers, keyword confirmation, reason gate, countdown, summary, undo hint, and async loading actions.</p>

				<div className="mt-4 flex flex-wrap gap-3">
					{/* Destructive with summary + count + undoHint + async loading */}
					<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<AlertDialogTrigger render={<Button variant="destructive" />}>Delete users</AlertDialogTrigger>
						<AlertDialogContent
							severity="critical"
							confirmLabel="Delete users"
							confirmLoading={confirmLoading}
							loadingLabel="Deleting…"
							confirmShortcut="⌘⏎"
							summary={destructiveSummary}
							count={12}
							undoHint="You have 5 seconds to undo after confirming."
							onConfirm={handleConfirm}
							actionOrder="cancel-first">
							<AlertDialogTitle>Delete {destructiveSummary[0]?.value ?? "12"} users?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently removes the selected accounts and revokes every session. <strong className="font-medium text-foreground">This cannot be undone.</strong>
							</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Keyword confirmation */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button variant="outline" />}>Type-to-confirm</AlertDialogTrigger>
						<AlertDialogContent severity="warning" requireConfirmation="reset staging" confirmLabel="Reset database">
							<AlertDialogTitle>Reset staging database?</AlertDialogTitle>
							<AlertDialogDescription>This wipes all staging data. Type the keyword to enable the confirm button.</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Reason gate + countdown */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button variant="secondary" />}>Lock account</AlertDialogTrigger>
						<AlertDialogContent severity="warning" requireReason delaySeconds={3} confirmLabel="Lock account">
							<AlertDialogTitle>Lock this account?</AlertDialogTitle>
							<AlertDialogDescription>The user will be signed out immediately and blocked from logging in.</AlertDialogDescription>
						</AlertDialogContent>
					</AlertDialog>

					{/* Media + form integration (feature 15) */}
					<AlertDialog>
						<AlertDialogTrigger render={<Button />}>Edit profile</AlertDialogTrigger>
						<AlertDialogContent severity="info" confirmLabel="Save changes">
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
