"use client";

// "Delete my account" (ADR 077). Smart component: reads the open request, asks for the password in a
// confirmation dialog before anything happens, explains what blocks it when something does, and during the
// 30-day grace period shows the date and a way to cancel. Asking signs the person out everywhere.

import { useQueryClient } from "@tanstack/react-query";
import { ACCOUNT_ERASURE_GRACE_DAYS, PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import * as React from "react";
import { z } from "zod";

import { apiRouter } from "../../api/endpoints";
import { ApiError } from "../../api/use-api";
import { useAuth } from "../identity";

const DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Delete my account", loading: "Deleting…" };
const BlockersSchema = z.object({ blockers: z.array(z.string()) });

/** A date as the person reads it, the same on the server and in the browser. */
function formatDay(ms: number): string {
	return formatEpochMs(ms, "date", PLATFORM_DISPLAY_REGION);
}

/** What the person is told when asking fails: the reasons it is blocked, or the API's message. */
export function describeErasureRefusal(error: Error): { readonly message: string; readonly blockers: readonly string[] } {
	const blockers = error instanceof ApiError ? BlockersSchema.safeParse(error.details) : null;
	return { message: error.message, blockers: blockers?.success === true ? blockers.data.blockers : [] };
}

/** The "Delete my account" section's body. */
export function DeleteMyAccountPanel(): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const statusQuery = api.privacy.erasure.useQuery({});
	const request = api.privacy.requestErasure.useMutation();
	const cancel = api.privacy.cancelErasure.useMutation();
	const [open, setOpen] = React.useState(false);
	const [password, setPassword] = React.useState("");
	const [refusal, setRefusal] = React.useState<{ readonly message: string; readonly blockers: readonly string[] } | null>(null);
	const erasure = statusQuery.data?.data.erasure ?? null;
	const pending = erasure?.status === "PENDING" ? erasure : null;

	const refresh = React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: apiRouter.privacy.erasure.scopeKey(undefined) });
	}, [queryClient]);
	const handleOpenChange = React.useCallback((next: boolean): void => {
		setOpen(next);
		if (!next) {
			setPassword("");
			setRefusal(null);
		}
	}, []);
	const handleOpen = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const handlePasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);
	const { mutateAsync: requestAsync } = request;
	const handleConfirm = React.useCallback((): void => {
		void (async (): Promise<void> => {
			setRefusal(null);
			try {
				const response = await requestAsync({ password });
				setOpen(false);
				setPassword("");
				refresh();
				toastMessage.success({
					title: "Your account will be deleted",
					description: `On ${formatDay(response.data.scheduledFor)}. You've been signed out everywhere; sign in before then to cancel.`,
				});
			} catch (caught) {
				setRefusal(describeErasureRefusal(caught instanceof Error ? caught : new Error("The request failed. Try again.")));
			}
		})();
	}, [password, refresh, requestAsync]);
	const { mutate: cancelMutate } = cancel;
	const handleCancelErasure = React.useCallback((): void => {
		cancelMutate(
			{},
			{
				onSuccess: (): void => {
					refresh();
					toastMessage.success({ title: "Your account won't be deleted", description: "The request is cancelled." });
				},
				onError: (error): void => {
					toastMessage.error({ title: "Couldn't cancel", description: error.message });
				},
			},
		);
	}, [cancelMutate, refresh]);

	if (pending !== null) {
		return (
			<div className="flex flex-col gap-3" data-slot="erasure-pending">
				<p className="text-sm text-foreground">
					Your account will be deleted on <span className="font-medium">{formatDay(pending.scheduledFor)}</span>
					{pending.requestedBy === "support" ? ", as our support team arranged at your request" : ""}. Until then you can change your mind.
				</p>
				<div>
					<Button type="button" variant="outline" onClick={handleCancelErasure} disabled={cancel.isPending}>
						Keep my account
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm text-muted-foreground">
				Your profile, settings, devices, inbox and invite codes are removed, and your name and email are taken off everything we must keep (a store&apos;s sales, security
				records). You&apos;re signed out at once, and it happens {String(ACCOUNT_ERASURE_GRACE_DAYS)} days later, so you can change your mind.
			</p>
			<div>
				<Button type="button" variant="destructive" onClick={handleOpen}>
					Delete my account
				</Button>
			</div>
			<AlertDialog open={open} onOpenChange={handleOpenChange}>
				<AlertDialogContent severity="critical" align="start" actionOrder="cancel-first" labels={DIALOG_LABELS} confirmLoading={request.isPending} onConfirm={handleConfirm}>
					<AlertDialogTitle>Delete your account?</AlertDialogTitle>
					<AlertDialogDescription>
						It&apos;s deleted in {String(ACCOUNT_ERASURE_GRACE_DAYS)} days and can&apos;t be undone after that. Download your data first if you want a copy.
					</AlertDialogDescription>
					<div className="flex flex-col gap-2">
						<Label htmlFor="erasure-password">Your password</Label>
						<Input id="erasure-password" type="password" autoComplete="current-password" value={password} onChange={handlePasswordChange} />
					</div>
					{refusal === null ? null : (
						<div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{refusal.blockers.length === 0 ? (
								refusal.message
							) : (
								<ul className="list-disc space-y-1 ps-4">
									{refusal.blockers.map((blocker) => (
										<li key={blocker}>{blocker}</li>
									))}
								</ul>
							)}
						</div>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
