// ============================================
// passkeys/passkeys-section.tsx - the account's passkeys, on the Security screen (ADR 080)
// ============================================
// Lists the signed-in account's passkeys (name, whether it is synced, when it was added and last used), adds
// one (the password again, then the phone's own prompt) and removes one after a confirmation. Every change
// reloads the list's query scope. Renaming is on the web apps' security page. On a phone that can't use
// passkeys the list still shows, and adding says why it can't.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
import { PASSKEY_NAME_MAX_LENGTH, StartPasskeyRegistrationSchema, type Passkey } from "@workspace/shared";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Alert } from "@workspace/ui-native/components/alert";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { DetailList } from "@workspace/ui-native/components/detail-list";
import { ErrorState, LoadingState } from "@workspace/ui-native/components/empty";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../features/toast/facade";
import { useApi } from "../../../lib/api-context";
import { formatDateTime, formatRelativeTime } from "../../../lib/time-format";
import { createPasskeyCredential, passkeyErrorMessage, passkeysSupported } from "./device-passkeys";
import { PASSKEYS_COPY } from "./labels";

interface PasskeyItemProps {
	readonly passkey: Passkey;
	readonly onRemove: (passkey: Passkey) => void;
}

function PasskeyItem({ passkey, onRemove }: PasskeyItemProps): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove(passkey);
	}, [onRemove, passkey]);
	const [now] = React.useState(Date.now);
	return (
		<View className="gap-2 rounded-xl border border-border p-3" testID={`passkey-${passkey.id}`}>
			<View className="flex-row items-center justify-between gap-2">
				<BodyText className="font-sans-semibold flex-1">{passkey.name}</BodyText>
				<Badge label={passkey.backedUp ? PASSKEYS_COPY.synced : PASSKEYS_COPY.singleDevice} tone={passkey.backedUp ? "success" : "neutral"} />
			</View>
			<DetailList
				items={[
					{ label: PASSKEYS_COPY.added, value: formatDateTime(passkey.createdAt) },
					{ label: PASSKEYS_COPY.lastUsed, value: passkey.lastUsedAt === null ? PASSKEYS_COPY.neverUsed : formatRelativeTime(passkey.lastUsedAt, now) },
				]}
			/>
			<Button label={PASSKEYS_COPY.remove} variant="outline" size="sm" onPress={remove} accessibilityLabel={`${PASSKEYS_COPY.remove} ${passkey.name}`} />
		</View>
	);
}

/** Adds a passkey: the name it will show here, the password again, then the phone's own prompt. */
function AddPasskey({ onAdded }: { readonly onAdded: () => Promise<void> }): React.JSX.Element {
	const api = useApi();
	const toast = useToast();
	const optionsMutation = api.auth.passkeyRegistrationOptions.useMutation();
	const registrationMutation = api.auth.passkeyRegistration.useMutation();
	const [name, setName] = React.useState(PASSKEYS_COPY.defaultName);
	const [password, setPassword] = React.useState("");
	const [pending, setPending] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const add = React.useCallback((): void => {
		const input = StartPasskeyRegistrationSchema.safeParse({ password });
		if (!input.success || name.trim().length === 0) {
			return;
		}
		setPending(true);
		setError(null);
		void (async (): Promise<void> => {
			try {
				const { data: started } = await optionsMutation.mutateAsync(input.data);
				const response = await createPasskeyCredential(started.options);
				await registrationMutation.mutateAsync({ challengeId: started.challengeId, name: name.trim(), response });
				setPassword("");
				setName(PASSKEYS_COPY.defaultName);
				toast.success(PASSKEYS_COPY.addedToast);
				await onAdded();
			} catch (caught) {
				setError(passkeyErrorMessage(caught instanceof Error ? caught : null));
			} finally {
				setPending(false);
			}
		})();
	}, [name, onAdded, optionsMutation, password, registrationMutation, toast]);

	return (
		<View className="gap-3 border-t border-border pt-3">
			<View className="gap-1">
				<BodyText className="font-sans-semibold">{PASSKEYS_COPY.addTitle}</BodyText>
				<MutedText>{PASSKEYS_COPY.addDescription}</MutedText>
			</View>
			{error === null ? null : <Alert tone="error" message={error} />}
			<TextField label={PASSKEYS_COPY.nameLabel} value={name} onChange={setName} maxLength={PASSKEY_NAME_MAX_LENGTH} testID="new-passkey-name" />
			<TextField
				label={PASSKEYS_COPY.passwordLabel}
				value={password}
				onChange={setPassword}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				testID="new-passkey-password"
			/>
			<Button label={PASSKEYS_COPY.add} onPress={add} loading={pending} disabled={password.length === 0 || name.trim().length === 0} />
		</View>
	);
}

/** The account's passkeys and the form that adds one. */
export function PasskeysSection(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const passkeys = api.auth.passkeys.useQuery(undefined);
	const removeMutation = api.auth.removePasskey.useMutation();
	const [supported] = React.useState(passkeysSupported);
	const [toRemove, setToRemove] = React.useState<Passkey | null>(null);

	const reload = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.passkeys.scopeKey(undefined) });
	}, [queryClient]);
	const retry = React.useCallback((): void => {
		void passkeys.refetch();
	}, [passkeys]);
	const askToRemove = React.useCallback(
		(passkey: Passkey): void => {
			removeMutation.reset();
			setToRemove(passkey);
		},
		[removeMutation],
	);
	const cancelRemove = React.useCallback((): void => {
		if (!removeMutation.isPending) {
			setToRemove(null);
		}
	}, [removeMutation.isPending]);
	const confirmRemove = React.useCallback((): void => {
		if (toRemove === null) {
			return;
		}
		removeMutation
			.mutateAsync({ passkeyId: toRemove.id })
			.then(async (): Promise<void> => {
				setToRemove(null);
				toast.success(PASSKEYS_COPY.removed);
				await reload();
			})
			.catch((): void => {
				// The dialog stays open with the error so the person can retry.
			});
	}, [reload, removeMutation, toRemove, toast]);

	const list = passkeys.data?.data.passkeys ?? [];
	return (
		<Card title={PASSKEYS_COPY.title} description={PASSKEYS_COPY.description}>
			<View className="gap-3" testID="passkeys-section">
				{passkeys.isPending ? <LoadingState label="Loading…" /> : null}
				{passkeys.isError ? <ErrorState message={PASSKEYS_COPY.loadFailed} retryLabel={PASSKEYS_COPY.retry} onRetry={retry} /> : null}
				{passkeys.isSuccess && list.length === 0 ? <MutedText>{PASSKEYS_COPY.empty}</MutedText> : null}
				{list.map((passkey: Passkey): React.JSX.Element => (
					<PasskeyItem key={passkey.id} passkey={passkey} onRemove={askToRemove} />
				))}
				{supported ? <AddPasskey onAdded={reload} /> : <MutedText>{PASSKEYS_COPY.unsupported}</MutedText>}
			</View>
			<AlertDialog
				visible={toRemove !== null}
				title={PASSKEYS_COPY.removeTitle(toRemove?.name ?? "")}
				description={PASSKEYS_COPY.removeDescription}
				confirmLabel={PASSKEYS_COPY.removeConfirm}
				cancelLabel={PASSKEYS_COPY.cancel}
				onConfirm={confirmRemove}
				onCancel={cancelRemove}
				pending={removeMutation.isPending}
				error={removeMutation.error === null ? null : passkeyErrorMessage(removeMutation.error)}
				destructive
			/>
		</Card>
	);
}
