"use client";

// ============================================
// passkeys/passkeys-section.tsx - the account's passkeys, on the security settings page (ADR 080)
// ============================================
// Lists the signed-in account's passkeys (name, whether it is synced, when it was added and last used) and
// manages them: add one (the password again, then the device's own prompt), rename one, remove one. Every
// change reloads the list's query scope; nothing is copied into local state. In a browser without WebAuthn
// the list still shows, and adding says why it can't.

import { useQueryClient } from "@tanstack/react-query";
import { PASSKEY_NAME_MAX_LENGTH, PLATFORM_DISPLAY_REGION, type CaughtValue, type Passkey } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { KeyRound, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { apiRouter } from "../../../api/endpoints";
import { resolveAuthErrorMessage } from "../../../api/error-messages";
import { catchCaught } from "../../../caught";
import { useAuth } from "../index";
import { createPasskeyCredential, passkeyBrowserErrorMessage, PASSKEY_BROWSER_MESSAGES } from "./browser-passkeys";
import { usePasskeysSupported } from "./use-passkeys-supported";
import { PASSKEYS_LABELS } from "./passkeys-labels";

/** The message for a failed step: the browser's own words for its half, the API's for the rest. */
function failureMessage(error: Error): string {
	return passkeyBrowserErrorMessage(error) ?? resolveAuthErrorMessage(error);
}

/** A rejection as an `Error` (anything else becomes the generic one). */
function errorOf(caught: CaughtValue): Error {
	return caught instanceof Error ? caught : new Error(PASSKEYS_LABELS.genericError);
}

interface PasskeyRowProps {
	readonly passkey: Passkey;
	readonly onRename: (passkey: Passkey, name: string) => Promise<void>;
	readonly onRemove: (passkey: Passkey) => void;
}

/** One passkey: its name (editable), how it is kept, and when it was added and last used. */
function PasskeyRow({ passkey, onRename, onRemove }: PasskeyRowProps): JSX.Element {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(passkey.name);
	const [saving, setSaving] = useState(false);
	// The name field takes focus when the member asks to rename (never on page load).
	const nameInputRef = useRef<HTMLInputElement>(null);
	useEffect((): void => {
		if (editing) {
			nameInputRef.current?.focus();
		}
	}, [editing]);

	const startEditing = useCallback((): void => {
		setName(passkey.name);
		setEditing(true);
	}, [passkey.name]);
	const stopEditing = useCallback((): void => {
		setEditing(false);
	}, []);
	const changeName = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);
	const save = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setSaving(true);
			void onRename(passkey, name.trim())
				.then((): void => {
					setEditing(false);
				})
				.finally((): void => {
					setSaving(false);
				});
		},
		[name, onRename, passkey],
	);
	const remove = useCallback((): void => {
		onRemove(passkey);
	}, [onRemove, passkey]);

	return (
		<li className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between" data-testid={`passkey-${passkey.id}`}>
			<div className="flex min-w-0 gap-3">
				<KeyRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
				<div className="min-w-0 space-y-1">
					{editing ? (
						<form className="flex flex-wrap items-center gap-2" onSubmit={save}>
							<Label htmlFor={`passkey-name-${passkey.id}`} className="sr-only">
								{PASSKEYS_LABELS.nameLabel}
							</Label>
							<Input ref={nameInputRef} id={`passkey-name-${passkey.id}`} value={name} onChange={changeName} maxLength={PASSKEY_NAME_MAX_LENGTH} className="h-8 w-56" />
							<Button type="submit" size="sm" loading={saving} disabled={name.trim().length === 0}>
								{PASSKEYS_LABELS.save}
							</Button>
							<Button type="button" size="sm" variant="ghost" onClick={stopEditing} disabled={saving}>
								{PASSKEYS_LABELS.cancel}
							</Button>
						</form>
					) : (
						<p className="truncate font-medium">{passkey.name}</p>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant={passkey.backedUp ? "success-light" : "secondary"} radius="full">
							{passkey.backedUp ? PASSKEYS_LABELS.synced : PASSKEYS_LABELS.singleDevice}
						</Badge>
					</div>
					<dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
						<div className="flex gap-1">
							<dt className="text-muted-foreground">{PASSKEYS_LABELS.added}:</dt>
							<dd>{formatEpochMs(passkey.createdAt, "dateTime", PLATFORM_DISPLAY_REGION)}</dd>
						</div>
						<div className="flex gap-1">
							<dt className="text-muted-foreground">{PASSKEYS_LABELS.lastUsed}:</dt>
							<dd>{passkey.lastUsedAt === null ? PASSKEYS_LABELS.neverUsed : <RelativeTime epochMs={passkey.lastUsedAt} region={PLATFORM_DISPLAY_REGION} />}</dd>
						</div>
					</dl>
				</div>
			</div>
			{editing ? null : (
				<div className="flex shrink-0 gap-2">
					<Button type="button" size="sm" variant="outline" onClick={startEditing}>
						{PASSKEYS_LABELS.rename}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={remove} aria-label={PASSKEYS_LABELS.removeNamed(passkey.name)}>
						<Trash2 aria-hidden="true" />
						{PASSKEYS_LABELS.remove}
					</Button>
				</div>
			)}
		</li>
	);
}

/** Adds a passkey: the name it will show here, the password again (ADR 080), then the device's own prompt. */
function AddPasskeyForm(): JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const optionsMutation = api.auth.passkeyRegistrationOptions.useMutation();
	const registrationMutation = api.auth.passkeyRegistration.useMutation();
	const supported = usePasskeysSupported();
	const [name, setName] = useState(PASSKEYS_LABELS.defaultName);
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const changeName = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);
	const changePassword = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);
	const add = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setPending(true);
			setError(null);
			void catchCaught(
				(async (): Promise<void> => {
					const { data: started } = await optionsMutation.mutateAsync({ password });
					const response = await createPasskeyCredential(started.options);
					await registrationMutation.mutateAsync({ challengeId: started.challengeId, name: name.trim(), response });
					await queryClient.invalidateQueries({ queryKey: apiRouter.auth.passkeys.scopeKey(undefined) });
					setPassword("");
					setName(PASSKEYS_LABELS.defaultName);
					toastMessage.success({ title: PASSKEYS_LABELS.addedTitle, description: PASSKEYS_LABELS.addedDescription });
				})(),
				(caught): void => {
					setError(failureMessage(errorOf(caught)));
				},
			).finally((): void => {
				setPending(false);
			});
		},
		[name, optionsMutation, password, queryClient, registrationMutation],
	);

	if (!supported) {
		return <p className="text-sm text-muted-foreground">{PASSKEY_BROWSER_MESSAGES.unsupportedBrowser}</p>;
	}
	return (
		<form className="space-y-3 border-t pt-4" onSubmit={add}>
			<div>
				<h3 className="text-sm font-semibold">{PASSKEYS_LABELS.addTitle}</h3>
				<p className="text-sm text-muted-foreground">{PASSKEYS_LABELS.addDescription}</p>
			</div>
			{error === null ? null : (
				<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			)}
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="new-passkey-name">{PASSKEYS_LABELS.nameLabel}</Label>
					<Input id="new-passkey-name" value={name} onChange={changeName} maxLength={PASSKEY_NAME_MAX_LENGTH} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="new-passkey-password">{PASSKEYS_LABELS.passwordLabel}</Label>
					<PasswordInput id="new-passkey-password" value={password} onChange={changePassword} autoComplete="current-password" />
				</div>
			</div>
			<Button type="submit" loading={pending} disabled={password.length === 0 || name.trim().length === 0}>
				<KeyRound aria-hidden="true" />
				{PASSKEYS_LABELS.add}
			</Button>
		</form>
	);
}

/** The account's passkeys and the form that adds one. */
export function PasskeysSection(): JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const passkeysQuery = api.auth.passkeys.useQuery(undefined, { retry: 1 });
	const renameMutation = api.auth.renamePasskey.useMutation();
	const removeMutation = api.auth.removePasskey.useMutation();
	const [toRemove, setToRemove] = useState<Passkey | null>(null);
	const reload = useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.passkeys.scopeKey(undefined) });
	}, [queryClient]);

	const rename = useCallback(
		async (passkey: Passkey, name: string): Promise<void> => {
			await catchCaught(renameMutation.mutateAsync({ passkeyId: passkey.id, name }).then(reload), (caught): void => {
				toastMessage.error({ title: PASSKEYS_LABELS.renameFailed, description: resolveAuthErrorMessage(errorOf(caught)) });
			});
		},
		[reload, renameMutation],
	);
	const askToRemove = useCallback(
		(passkey: Passkey): void => {
			removeMutation.reset();
			setToRemove(passkey);
		},
		[removeMutation],
	);
	const changeRemoveDialog = useCallback((open: boolean): void => {
		if (!open) {
			setToRemove(null);
		}
	}, []);
	const confirmRemove = useCallback((): void => {
		if (toRemove === null) {
			return;
		}
		void catchCaught(
			removeMutation.mutateAsync({ passkeyId: toRemove.id }).then(async (): Promise<void> => {
				setToRemove(null);
				await reload();
				toastMessage.success({ title: PASSKEYS_LABELS.removedTitle });
			}),
			(): void => {
				// Shown in the dialog (removeMutation.error), which stays open.
			},
		);
	}, [reload, removeMutation, toRemove]);
	const removeDialogLabels = useMemo((): UiKitLabelsOverride<"alertDialog"> => ({ confirm: PASSKEYS_LABELS.removeConfirm, loading: PASSKEYS_LABELS.removing }), []);
	const loadingLabels = useMemo((): UiKitLabelsOverride<"skeletonRegion"> => ({ loading: PASSKEYS_LABELS.loading }), []);

	const passkeys = passkeysQuery.data?.data.passkeys ?? [];
	return (
		<div className="space-y-4">
			{passkeysQuery.isPending ? (
				<SkeletonRegion labels={loadingLabels}>
					<Skeleton className="h-20 w-full" />
				</SkeletonRegion>
			) : passkeysQuery.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{resolveAuthErrorMessage(passkeysQuery.error)}
				</p>
			) : passkeys.length === 0 ? (
				<p className="text-sm text-muted-foreground">{PASSKEYS_LABELS.empty}</p>
			) : (
				<ul className="space-y-3" aria-label={PASSKEYS_LABELS.listLabel}>
					{passkeys.map((passkey: Passkey): JSX.Element => (
						<PasskeyRow key={passkey.id} passkey={passkey} onRename={rename} onRemove={askToRemove} />
					))}
				</ul>
			)}
			<AddPasskeyForm />
			<AlertDialog open={toRemove !== null} onOpenChange={changeRemoveDialog}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={removeDialogLabels}
					confirmLoading={removeMutation.isPending}
					onConfirm={confirmRemove}>
					<AlertDialogMedia severity="critical">
						<Trash2 aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>{PASSKEYS_LABELS.removeTitle(toRemove?.name ?? "")}</AlertDialogTitle>
					<AlertDialogDescription>{PASSKEYS_LABELS.removeDescription}</AlertDialogDescription>
					{removeMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{resolveAuthErrorMessage(removeMutation.error)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
