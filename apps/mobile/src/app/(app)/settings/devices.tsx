// ============================================
// Signed-in devices (§10.11) — GET /auth/sessions, revoke one, sign out everywhere
// ============================================
// The list comes from the API (current device first, then by last activity —
// the server sorts it). Revoking another device takes effect on its next
// request (ADR 034); the list refetches after it.

import type { Session } from "@workspace/shared";
import { apiRouter } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { View } from "react-native";

import { Banner } from "../../../components/banner";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { DeviceSessionRow } from "../../../components/device-session-row";
import { Screen } from "../../../components/screen";
import { EmptyState, ErrorState, LoadingState } from "../../../components/states";
import { DEVICES_COPY } from "../../../features/devices/labels";
import { clientTypeLabelOf, platformLineOf, sessionDetailItems } from "../../../features/devices/session-details";
import { SignOutEverywhere } from "../../../features/devices/sign-out-everywhere";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";

export default function DevicesScreen(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const sessions = api.auth.sessions.useQuery(undefined);
	const revoke = api.auth.revokeSession.useMutation();
	const [deviceToRevoke, setDeviceToRevoke] = React.useState<Session | null>(null);
	const [revokedLabel, setRevokedLabel] = React.useState<string | null>(null);
	const nowMs = sessions.dataUpdatedAt;

	const refetch = React.useCallback((): void => {
		void sessions.refetch();
	}, [sessions]);
	const requestRevoke = React.useCallback(
		(session: Session): void => {
			revoke.reset();
			setRevokedLabel(null);
			setDeviceToRevoke(session);
		},
		[revoke],
	);
	const cancelRevoke = React.useCallback((): void => {
		if (!revoke.isPending) {
			setDeviceToRevoke(null);
		}
	}, [revoke.isPending]);
	const confirmRevoke = React.useCallback((): void => {
		if (deviceToRevoke === null) {
			return;
		}
		const target = deviceToRevoke;
		revoke
			.mutateAsync({ sessionId: target.id })
			.then(async (): Promise<void> => {
				setDeviceToRevoke(null);
				setRevokedLabel(target.label);
				await queryClient.invalidateQueries({ queryKey: apiRouter.auth.sessions.scopeKey(undefined) });
			})
			.catch((): void => {
				// The dialog stays open with the error so the user can retry.
			});
	}, [deviceToRevoke, queryClient, revoke]);

	const list = sessions.data?.data;
	return (
		<Screen title={DEVICES_COPY.title} description={DEVICES_COPY.description} refreshing={sessions.isRefetching} onRefresh={refetch}>
			{revokedLabel === null ? null : <Banner tone="success" message={DEVICES_COPY.revoked(revokedLabel)} />}
			{sessions.isPending ? <LoadingState label={DEVICES_COPY.loading} /> : null}
			{sessions.isError ? <ErrorState message={DEVICES_COPY.loadError} retryLabel={DEVICES_COPY.retry} onRetry={refetch} /> : null}
			{list?.length === 0 ? <EmptyState message={DEVICES_COPY.empty} /> : null}
			{list === undefined || list.length === 0 ? null : (
				<View accessibilityLabel={DEVICES_COPY.title}>
					{list.map((session: Session): React.JSX.Element => (
						<DeviceRow
							key={session.id}
							session={session}
							nowMs={nowMs}
							onRevokeRequest={requestRevoke}
							isRevoking={revoke.isPending ? deviceToRevoke?.id === session.id : false}
						/>
					))}
				</View>
			)}
			<SignOutEverywhere />
			<ConfirmDialog
				visible={deviceToRevoke !== null}
				title={DEVICES_COPY.revokeTitle(deviceToRevoke?.label ?? "")}
				description={DEVICES_COPY.revokeDescription}
				confirmLabel={DEVICES_COPY.revokeConfirm}
				cancelLabel={DEVICES_COPY.cancel}
				onConfirm={confirmRevoke}
				onCancel={cancelRevoke}
				pending={revoke.isPending}
				error={revoke.error === null ? null : errorMessageOf(revoke.error)}
				destructive
			/>
		</Screen>
	);
}

interface DeviceRowProps {
	readonly session: Session;
	readonly nowMs: number;
	readonly onRevokeRequest: (session: Session) => void;
	readonly isRevoking: boolean;
}

function DeviceRow({ session, nowMs, onRevokeRequest, isRevoking }: DeviceRowProps): React.JSX.Element {
	const handleRevoke = React.useCallback((): void => {
		onRevokeRequest(session);
	}, [onRevokeRequest, session]);
	return (
		<DeviceSessionRow
			label={session.label}
			clientTypeLabel={clientTypeLabelOf(session)}
			platform={platformLineOf(session)}
			details={sessionDetailItems(session, nowMs)}
			isCurrent={session.isCurrent}
			currentLabel={DEVICES_COPY.thisDevice}
			revokeLabel={DEVICES_COPY.revoke}
			onRevoke={handleRevoke}
			isRevoking={isRevoking}
		/>
	);
}
