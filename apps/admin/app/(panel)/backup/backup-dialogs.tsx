"use client";

import type { BackupEntry } from "@workspace/shared";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/overlay/alert-dialog";
import { DatabaseZap, TriangleAlert } from "lucide-react";

export function BackupDeleteDialog({
	targets,
	pending,
	onOpenChange,
	onConfirm,
}: {
	readonly targets: readonly BackupEntry[] | null;
	readonly pending: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onConfirm: () => void;
}): React.JSX.Element {
	return (
		<AlertDialog open={targets !== null} onOpenChange={onOpenChange}>
			<AlertDialogContent
				severity="critical"
				confirmLabel={targets !== null && targets.length > 1 ? "Delete backups" : "Delete backup"}
				confirmLoading={pending}
				loadingLabel="Deleting…"
				onConfirm={onConfirm}>
				<AlertDialogHeader align="start">
					<AlertDialogMedia severity="critical">
						<TriangleAlert className="size-6" />
					</AlertDialogMedia>
					<AlertDialogTitle>{targets !== null && targets.length > 1 ? `Delete ${String(targets.length)} backups?` : "Delete this backup?"}</AlertDialogTitle>
					<AlertDialogDescription>
						{targets !== null && targets.length > 1
							? "The selected compressed files and history rows will be permanently removed. This cannot be undone."
							: `"${targets?.[0]?.name ?? ""}" and its compressed file will be permanently removed. This cannot be undone.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function BackupRestoreDialog({
	target,
	name,
	password,
	pending,
	onOpenChange,
	onConfirm,
	onNameChange,
	onPasswordChange,
}: {
	readonly target: BackupEntry | null;
	readonly name: string;
	readonly password: string;
	readonly pending: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onConfirm: () => void;
	readonly onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
	return (
		<AlertDialog open={target !== null} onOpenChange={onOpenChange}>
			<AlertDialogContent severity="info" confirmLabel="Restore backup" confirmLoading={pending} loadingLabel="Restoring…" onConfirm={onConfirm}>
				<AlertDialogHeader align="start">
					<AlertDialogMedia severity="info">
						<DatabaseZap className="size-6" />
					</AlertDialogMedia>
					<AlertDialogTitle>Restore this backup?</AlertDialogTitle>
					<AlertDialogDescription>
						"{target?.name}" will be restored into a brand-new database. No existing database is ever touched or overwritten. The new database is left in place so you can
						inspect it — dropping it later is a manual <code className="rounded bg-muted px-1 py-0.5 text-xs">DROP DATABASE</code>.
					</AlertDialogDescription>
					<div className="space-y-2">
						<Label htmlFor="restore-name">Target database name (optional)</Label>
						<Input
							id="restore-name"
							value={name}
							onChange={onNameChange}
							placeholder={`restored_${target?.name ?? "backup"}_20260818_120000`}
							disabled={pending}
							autoComplete="off"
							maxLength={63}
						/>
						<p className="text-xs text-muted-foreground">Letters, numbers and underscore only — auto-generated when left blank.</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="restore-password">Confirm your password</Label>
						<Input
							id="restore-password"
							type="password"
							value={password}
							onChange={onPasswordChange}
							placeholder="Re-enter your password to restore"
							disabled={pending}
							autoComplete="current-password"
						/>
						<p className="text-xs text-muted-foreground">Restore creates a real database, so we re-verify your credentials first.</p>
					</div>
				</AlertDialogHeader>
			</AlertDialogContent>
		</AlertDialog>
	);
}
