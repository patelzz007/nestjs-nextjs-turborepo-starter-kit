"use client";

import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { PLATFORM_DISPLAY_REGION, type Session } from "@workspace/shared";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { ListPager } from "@workspace/ui/components/list-pager";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { LogOut, ShieldAlert } from "lucide-react";
import { useCallback, useMemo, useState, type JSX } from "react";

import { apiRouter } from "../../../api/endpoints";
import { useUrlListPager } from "../../../url-state/use-url-list-pager";
import { useUrlState } from "../../../url-state/use-url-state";
import { catchCaught } from "../../../caught";
import { resolveAuthErrorMessage } from "../../../api/error-messages";
import { useAuth } from "../index";
import { DeviceSessionRow } from "./device-session-row";
import { SignedInDevicesSkeleton } from "./signed-in-devices-skeleton";
import { SIGNED_IN_DEVICES_LABELS, type SignedInDevicesLabels } from "./signed-in-devices-labels";
import { SESSIONS_URL_STATE, toSessionsQuery } from "./sessions-url-state";

export interface SignedInDevicesSectionProps {
	/** The section's copy; English by default. */
	readonly labels?: SignedInDevicesLabels;
}

/**
 * "Signed-in devices" of the shared security settings panel (web, merchant and
 * admin — docs/technical/mobile/mobile-app.md §8.8). Lists every session of
 * the account on every client type (`GET /auth/sessions`, most recently active
 * first, one URL-addressed page at a time), revokes another device after a confirmation
 * naming it (`POST /auth/sessions/:sessionId/revoke`, effective on that
 * device's next request — ADR 034), and signs out everywhere after a
 * confirmation that says it includes this device and the mobile app.
 *
 * Owns the data: the list comes from the API through the shared hooks, and a
 * revocation invalidates the list's query scope — nothing is copied into
 * local state but the dialog targets.
 */
export function SignedInDevicesSection({ labels = SIGNED_IN_DEVICES_LABELS }: SignedInDevicesSectionProps): JSX.Element {
	const { api, logoutEverywhere } = useAuth();
	const queryClient = useQueryClient();
	// The page is URL state (`?devicesPage=`); a page move pushes a history entry, so Back returns to it.
	const [urlState, updateUrlState] = useUrlState(SESSIONS_URL_STATE);
	const sessionsQuery = api.auth.sessions.useQuery(toSessionsQuery(urlState), { retry: 1, placeholderData: keepPreviousData });
	const revokeMutation = api.auth.revokeSession.useMutation();
	const [deviceToRevoke, setDeviceToRevoke] = useState<Session | null>(null);
	const [isSignOutEverywhereOpen, setSignOutEverywhereOpen] = useState(false);
	const [isSigningOutEverywhere, setSigningOutEverywhere] = useState(false);

	const sessions: readonly Session[] | undefined = sessionsQuery.data?.data;
	const pager = useUrlListPager(urlState, updateUrlState, sessionsQuery.data?.meta);
	const isRevoking: boolean = revokeMutation.isPending;
	/** The session whose revoke is in flight, if any. */
	const revokingSessionId: string | null = isRevoking ? (deviceToRevoke?.id ?? null) : null;
	const revokeDialogLabels = useMemo((): UiKitLabelsOverride<"alertDialog"> => ({ confirm: labels.revokeConfirm, loading: labels.revokePending }), [labels]);
	const loadingLabels = useMemo((): UiKitLabelsOverride<"skeletonRegion"> => ({ loading: labels.loading }), [labels]);
	const signOutEverywhereDialogLabels = useMemo(
		(): UiKitLabelsOverride<"alertDialog"> => ({ confirm: labels.signOutEverywhereConfirm, loading: labels.signOutEverywherePending }),
		[labels],
	);

	const handleRetry = useCallback((): void => {
		void sessionsQuery.refetch();
	}, [sessionsQuery]);

	const pagerLabels = useMemo((): UiKitLabelsOverride<"listPager"> => ({ ariaLabel: labels.pagesLabel }), [labels]);

	const handleRevokeRequest = useCallback(
		(session: Session): void => {
			revokeMutation.reset();
			setDeviceToRevoke(session);
		},
		[revokeMutation],
	);

	const handleRevokeDialogChange = useCallback(
		(open: boolean): void => {
			if (!open && !isRevoking) {
				setDeviceToRevoke(null);
			}
		},
		[isRevoking],
	);

	const handleConfirmRevoke = useCallback((): void => {
		if (deviceToRevoke === null) {
			return;
		}
		const revoked: Session = deviceToRevoke;
		// On failure the dialog stays open with the error, so the member can retry.
		void catchCaught(
			revokeMutation.mutateAsync({ sessionId: revoked.id }).then(async (): Promise<void> => {
				setDeviceToRevoke(null);
				toastMessage.success({ title: labels.revokedTitle, description: labels.revokedDescription(revoked.label) });
				await queryClient.invalidateQueries({ queryKey: apiRouter.auth.sessions.scopeKey(undefined) });
			}),
			(): void => undefined,
		);
	}, [deviceToRevoke, labels, queryClient, revokeMutation]);

	const handleSignOutEverywhereRequest = useCallback((): void => {
		setSignOutEverywhereOpen(true);
	}, []);

	const handleSignOutEverywhereDialogChange = useCallback(
		(open: boolean): void => {
			if (!open && !isSigningOutEverywhere) {
				setSignOutEverywhereOpen(false);
			}
		},
		[isSigningOutEverywhere],
	);

	const handleConfirmSignOutEverywhere = useCallback((): void => {
		setSigningOutEverywhere(true);
		void logoutEverywhere().then((confirmed: boolean): void => {
			setSigningOutEverywhere(false);
			setSignOutEverywhereOpen(false);
			if (!confirmed) {
				toastMessage.error({ title: labels.signOutEverywhereFailedTitle, description: labels.signOutEverywhereFailedDescription });
			}
		});
	}, [labels, logoutEverywhere]);

	return (
		<div className="space-y-4">
			{sessionsQuery.isPending ? (
				<SkeletonRegion labels={loadingLabels}>
					<SignedInDevicesSkeleton />
				</SkeletonRegion>
			) : sessionsQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>{labels.loadErrorTitle}</AlertTitle>
					<AlertDescription>{labels.loadErrorDescription}</AlertDescription>
					<AlertAction>
						<Button type="button" variant="outline" size="sm" onClick={handleRetry}>
							{labels.retry}
						</Button>
					</AlertAction>
				</Alert>
			) : (sessions === undefined || sessions.length === 0) && pager.hasPrevious ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
					<span>{labels.pastLastPage}</span>
					<Button type="button" variant="outline" size="sm" onClick={pager.onFirstPage}>
						{labels.firstPage}
					</Button>
				</div>
			) : sessions === undefined || sessions.length === 0 ? (
				<div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">{labels.empty}</div>
			) : (
				<>
					<ul className="divide-y" aria-label={labels.listLabel}>
						{sessions.map((session: Session): JSX.Element => (
							<DeviceSessionRow
								key={session.id}
								session={session}
								labels={labels}
								region={PLATFORM_DISPLAY_REGION}
								onRevokeRequest={handleRevokeRequest}
								isRevoking={revokingSessionId === session.id}
							/>
						))}
					</ul>
					{pager.isPaged ? (
						<ListPager
							page={pager.page}
							totalPages={pager.totalPages}
							hasPrevious={pager.hasPrevious}
							hasNext={pager.hasNext}
							onPrevious={pager.onPrevious}
							onNext={pager.onNext}
							disabled={sessionsQuery.isPlaceholderData}
							labels={pagerLabels}
						/>
					) : null}
				</>
			)}

			<div className="border-t pt-4">
				<Button type="button" variant="outline" onClick={handleSignOutEverywhereRequest}>
					<LogOut aria-hidden="true" />
					{labels.signOutEverywhere}
				</Button>
			</div>

			<AlertDialog open={deviceToRevoke !== null} onOpenChange={handleRevokeDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={revokeDialogLabels}
					confirmLoading={isRevoking}
					onConfirm={handleConfirmRevoke}>
					<AlertDialogMedia severity="critical">
						<ShieldAlert aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>{labels.revokeTitle(deviceToRevoke?.label ?? "")}</AlertDialogTitle>
					<AlertDialogDescription>{labels.revokeDescription}</AlertDialogDescription>
					{revokeMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{resolveAuthErrorMessage(revokeMutation.error)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={isSignOutEverywhereOpen} onOpenChange={handleSignOutEverywhereDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={signOutEverywhereDialogLabels}
					confirmLoading={isSigningOutEverywhere}
					onConfirm={handleConfirmSignOutEverywhere}>
					<AlertDialogMedia severity="critical">
						<LogOut aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>{labels.signOutEverywhereTitle}</AlertDialogTitle>
					<AlertDialogDescription>{labels.signOutEverywhereDescription}</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
