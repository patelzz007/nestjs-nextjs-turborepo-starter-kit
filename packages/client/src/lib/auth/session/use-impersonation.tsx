"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { useCallback, useState, type JSX } from "react";

import { catchCaught } from "../../caught";
import { resolveAuthErrorMessage } from "../errors";
import { useAuth } from "../index";

/** Who the super-admin is about to act as — shown in the confirmation. */
export interface ImpersonationTarget {
	readonly userId: string;
	/** A human label for the confirmation (email or name). */
	readonly label: string;
}

export interface UseImpersonationOptions {
	/**
	 * Runs after the identity changed (started or stopped) — e.g. `router.refresh()`
	 * so server-rendered layouts render for the new identity.
	 */
	readonly onIdentityChanged?: (() => void) | undefined;
}

export interface ImpersonationControls {
	/** Opens the confirmation; impersonation starts only when the super-admin confirms. */
	readonly requestStart: (target: ImpersonationTarget) => void;
	/** Ends the impersonation and switches the tab back to the super-admin. */
	readonly stop: () => void;
	readonly isPending: boolean;
	/** Render once wherever the hook is used. */
	readonly confirmDialog: JSX.Element;
}

/** This dialog's own wording; every other string comes from the app's UI kit labels. */
const IMPERSONATION_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = {
	confirm: "Impersonate",
	loading: "Starting…",
};

/**
 * Starting or stopping an impersonation changes WHO this tab is. Both go
 * through the auth commands as a sign-in of the new identity (`login` with the
 * server's answer), so the auth store starts a new session epoch, the query
 * cache of the previous identity is cleared, the scope is re-read and the
 * other tabs re-check — never a partial cache invalidation that could leave
 * the previous identity's data on screen. Failures are reported, never
 * swallowed. Starting asks for confirmation first.
 *
 * Not yet captured: a written REASON for the impersonation — the API's
 * impersonate contract has no field for it yet.
 */
export function useImpersonation({ onIdentityChanged }: UseImpersonationOptions = {}): ImpersonationControls {
	const { api, login } = useAuth();
	const impersonateMutation = api.auth.impersonate.useMutation();
	const stopMutation = api.auth.stopImpersonation.useMutation();
	const [target, setTarget] = useState<ImpersonationTarget | null>(null);

	const reportFailure = useCallback((title: string, error: Parameters<typeof resolveAuthErrorMessage>[0]): void => {
		toastMessage.error({ title, description: resolveAuthErrorMessage(error) });
	}, []);

	const start = useCallback(
		async (userId: string): Promise<void> => {
			await catchCaught(
				impersonateMutation.mutateAsync({ userId }).then((response): void => {
					login(response.data.user, response.meta);
					onIdentityChanged?.();
				}),
				(error): void => {
					reportFailure("Could not start impersonation", error);
				},
			);
		},
		[impersonateMutation, login, onIdentityChanged, reportFailure],
	);

	const stop = useCallback((): void => {
		void catchCaught(
			stopMutation.mutateAsync({}).then(async (): Promise<void> => {
				// The stop answer carries no profile: read the restored identity from the server.
				const me = await api.auth.me.fetchOrThrow(undefined);
				login(me.data, me.meta);
				onIdentityChanged?.();
			}),
			(error): void => {
				reportFailure("Could not stop impersonation", error);
			},
		);
	}, [api.auth.me, login, onIdentityChanged, reportFailure, stopMutation]);

	const handleOpenChange = useCallback(
		(open: boolean): void => {
			if (!open && !impersonateMutation.isPending) {
				setTarget(null);
			}
		},
		[impersonateMutation.isPending],
	);

	const handleConfirm = useCallback((): void => {
		if (target === null) {
			return;
		}
		void start(target.userId).finally((): void => {
			setTarget(null);
		});
	}, [start, target]);

	const confirmDialog = (
		<AlertDialog open={target !== null} onOpenChange={handleOpenChange}>
			<AlertDialogContent
				severity="warning"
				align="start"
				actionOrder="cancel-first"
				labels={IMPERSONATION_DIALOG_LABELS}
				confirmLoading={impersonateMutation.isPending}
				onConfirm={handleConfirm}>
				<AlertDialogTitle>Impersonate {target?.label ?? "this user"}?</AlertDialogTitle>
				<AlertDialogDescription>
					This tab will act as that account until you stop. Every action is recorded against your super-admin identity and theirs.
				</AlertDialogDescription>
			</AlertDialogContent>
		</AlertDialog>
	);

	return {
		requestStart: setTarget,
		stop,
		isPending: impersonateMutation.isPending || stopMutation.isPending,
		confirmDialog,
	};
}
