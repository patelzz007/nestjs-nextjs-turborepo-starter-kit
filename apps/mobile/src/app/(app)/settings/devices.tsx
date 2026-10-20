// ============================================
// Signed-in devices (§10.11) — GET /auth/sessions, revoke one, sign out everywhere
// ============================================
// The list comes from the API one page at a time, most recently active first
// (`isCurrent` marks this phone); "Load more" appends the next page. Revoking
// another device takes effect on its next request (ADR 034); every page
// refetches after it.

import { ApiPaginatedMetaSchema, LIST_FIRST_PAGE, SESSION_LIST_PAGE_SIZE, type Session } from "@workspace/shared";
import { apiRouter } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { View } from "react-native";

import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Button } from "@workspace/ui-native/components/button";
import { DeviceSessionRow } from "../../../components/device-session-row";
import { Screen } from "../../../components/screen";
import { EmptyState, ErrorState, LoadingState } from "@workspace/ui-native/components/empty";
import { clientTypeLabelOf, DEVICES_COPY, platformLineOf, sessionDetailItems, SignOutEverywhere } from "../../../contexts/identity";
import { useToast } from "../../../features/toast/facade";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";
import { useCursorPages } from "../../../lib/use-cursor-pages";

export default function DevicesScreen(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const pages = useCursorPages();
	const revoke = api.auth.revokeSession.useMutation();
	const [deviceToRevoke, setDeviceToRevoke] = React.useState<Session | null>(null);
	const [refreshing, setRefreshing] = React.useState(false);
	const toast = useToast();

	const refreshList = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.sessions.scopeKey(undefined) });
	}, [queryClient]);
	const refresh = React.useCallback((): void => {
		setRefreshing(true);
		pages.reset();
		void refreshList().finally((): void => {
			setRefreshing(false);
		});
	}, [pages, refreshList]);
	const requestRevoke = React.useCallback(
		(session: Session): void => {
			revoke.reset();
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
				toast.success(DEVICES_COPY.revoked(target.label));
				// Back to the first page: the revoke shifted every later row, so cursors taken before it
				// would start the next pages in the wrong place (a row twice, or one skipped).
				pages.reset();
				await refreshList();
			})
			.catch((): void => {
				// The dialog stays open with the error so the user can retry.
			});
	}, [deviceToRevoke, pages, refreshList, revoke, toast]);

	const revokingId = revoke.isPending ? (deviceToRevoke?.id ?? null) : null;
	return (
		<Screen description={DEVICES_COPY.description} refreshing={refreshing} onRefresh={refresh}>
			<View accessibilityLabel={DEVICES_COPY.title}>
				{pages.cursors.map((cursor: string | undefined, index: number): React.JSX.Element => (
					<DevicesPage
						key={cursor ?? "first"}
						cursor={cursor}
						isLast={index === pages.cursors.length - 1}
						onLoadMore={pages.loadMore}
						onRevokeRequest={requestRevoke}
						revokingId={revokingId}
					/>
				))}
			</View>
			<SignOutEverywhere />
			<AlertDialog
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

interface DevicesPageProps {
	/** The keyset cursor this page starts at (`undefined`: the first page). */
	readonly cursor: string | undefined;
	/** Only the last page shown offers "Load more". */
	readonly isLast: boolean;
	readonly onLoadMore: (cursor: string) => void;
	readonly onRevokeRequest: (session: Session) => void;
	/** The device whose sign-out is in flight, if any. */
	readonly revokingId: string | null;
}

function DevicesPage({ cursor, isLast, onLoadMore, onRevokeRequest, revokingId }: DevicesPageProps): React.JSX.Element | null {
	const api = useApi();
	// A cursor positions the page by itself; `page` only matters for the first one.
	const page = api.auth.sessions.useQuery({ page: LIST_FIRST_PAGE, limit: SESSION_LIST_PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) });
	const retry = React.useCallback((): void => {
		void page.refetch();
	}, [page]);
	const nextCursor = ApiPaginatedMetaSchema.safeParse(page.data?.meta).data?.nextCursor ?? null;
	const loadMore = React.useCallback((): void => {
		if (nextCursor !== null) {
			onLoadMore(nextCursor);
		}
	}, [nextCursor, onLoadMore]);

	if (page.isPending) {
		return <LoadingState label={DEVICES_COPY.loading} />;
	}
	if (page.isError) {
		return <ErrorState message={DEVICES_COPY.loadError} retryLabel={DEVICES_COPY.retry} onRetry={retry} />;
	}
	const sessions = page.data.data;
	if (cursor === undefined && sessions.length === 0) {
		return <EmptyState message={DEVICES_COPY.empty} />;
	}
	return (
		<View>
			{sessions.map((session: Session): React.JSX.Element => (
				<DeviceRow key={session.id} session={session} nowMs={page.dataUpdatedAt} onRevokeRequest={onRevokeRequest} isRevoking={revokingId === session.id} />
			))}
			{isLast && nextCursor !== null ? (
				<View className="pt-4">
					<Button label={DEVICES_COPY.loadMore} variant="secondary" onPress={loadMore} testID="devices-load-more" />
				</View>
			) : null}
		</View>
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
