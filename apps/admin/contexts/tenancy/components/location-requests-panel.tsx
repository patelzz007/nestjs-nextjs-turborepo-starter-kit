"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { Can } from "@workspace/client/lib/contexts/authorization";
import { AdminLocationRequestResponseSchema, PERMISSION, type AdminLocationRequestResponse, type AdminLocationReviewInput, type Envelope } from "@workspace/shared";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { STORE_REQUEST_QUEUE_LOADING_LABELS } from "@/components/loading/loading-labels";
import { StoreRequestRowsSkeleton } from "@/components/loading/merchant-skeletons";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PENDING_LOCATION_REQUESTS_QUERY } from "@/contexts/tenancy/lib/location-requests";
import { toastMutationError } from "@/lib/api/mutation-error";
import { pilotCityLabel } from "@/lib/format/pilot-city";
import { ROUTES } from "@/lib/routes";

import { StoreRequestReviewForm } from "./store-request-review-form";
import { STORE_REQUESTS_URL_STATE } from "@/lib/url-state/selection";

/** Shown when a request names no city. */
const NO_CITY_LABEL = "Not set";

interface LocationRequestRowProps {
	readonly request: AdminLocationRequestResponse;
	readonly isSelected: boolean;
	readonly onSelect: (requestId: string) => void;
}

function LocationRequestRow({ request, isSelected, onSelect }: LocationRequestRowProps): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onSelect(request.id);
	}, [onSelect, request.id]);

	return (
		<button
			type="button"
			onClick={handleSelect}
			className={`w-full rounded-lg border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="font-medium text-foreground">{request.name}</p>
					<p className="text-sm text-muted-foreground">{request.tenantDisplayName}</p>
				</div>
				<Badge variant="outline">Pending</Badge>
			</div>
		</button>
	);
}

export interface LocationRequestsPanelProps {
	/** The API's own envelope (real pagination meta) of the pending queue, prefetched on the server. */
	readonly initialPendingRequests?: Envelope<AdminLocationRequestResponse[]> | undefined;
}

/**
 * Store location request queue. The request open in the review panel is
 * exactly `?requestId=` (lib/url-state/selection) — never another request in
 * its place: when it is not in the loaded queue (already reviewed, or beyond
 * the first page) the panel says so. Reviewing clears the selection.
 */
export default function LocationRequestsPanel({ initialPendingRequests }: LocationRequestsPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [selection, updateSelection] = useUrlState(STORE_REQUESTS_URL_STATE);

	const requestsQuery = api.rewardsAdmin.listLocationRequests.useQuery(PENDING_LOCATION_REQUESTS_QUERY, initialDataOption(initialPendingRequests));

	const reviewMutation = api.rewardsAdmin.reviewLocation.useMutation({
		onSuccess: async (_response, { tenantId }): Promise<void> => {
			toastMessage.success({ title: "Store request updated" });
			// The reviewed request leaves the queue — nothing stays selected in its place.
			updateSelection({ requestId: undefined });
			// The review changes the queue, the reviewed tenant (its stores) and the merchant list.
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.listLocationRequests.scopeKey(undefined) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getTenant.scopeKey({ tenantId }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.listTenants.scopeKey(undefined) }),
			]);
		},
		onError: (error): void => {
			toastMutationError("Could not update the store request", error);
		},
	});

	const requests = requestsQuery.data?.data ?? [];
	// The server's count of every pending request — the queue loads only its first page.
	const pendingTotal: number = readPaginatedTotal(requestsQuery.data?.meta);
	const selectedRequest: AdminLocationRequestResponse | undefined =
		selection.requestId === undefined ? undefined : requests.find((request) => request.id === selection.requestId);
	const isSelectionOutOfView: boolean = selection.requestId !== undefined && selectedRequest === undefined && !requestsQuery.isLoading;

	const handleReview = React.useCallback(
		(review: AdminLocationReviewInput): void => {
			if (selectedRequest === undefined) {
				return;
			}
			reviewMutation.mutate({ tenantId: selectedRequest.tenantId, locationId: selectedRequest.id, ...review });
		},
		[reviewMutation, selectedRequest],
	);

	const handleClearSelection = React.useCallback((): void => {
		updateSelection({ requestId: undefined });
	}, [updateSelection]);

	const handleSelectRequest = React.useCallback(
		(requestId: string): void => {
			const parsed = AdminLocationRequestResponseSchema.shape.id.safeParse(requestId);
			if (parsed.success) {
				updateSelection({ requestId: parsed.data });
			}
		},
		[updateSelection],
	);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Store location requests</h1>
				<p className="mt-1 text-sm text-muted-foreground">Approve or reject additional merchant stores before they become visible to customers.</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Pending queue</CardTitle>
						<CardDescription>
							{String(pendingTotal)} request{pendingTotal === 1 ? "" : "s"} awaiting review
							{pendingTotal > requests.length ? ` — showing the oldest ${String(requests.length)}` : ""}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{requestsQuery.isLoading ? (
							<SkeletonRegion labels={STORE_REQUEST_QUEUE_LOADING_LABELS} className="flex flex-col gap-2">
								<StoreRequestRowsSkeleton />
							</SkeletonRegion>
						) : null}
						{requests.length === 0 && !requestsQuery.isLoading ? <p className="text-sm text-muted-foreground">No pending store requests.</p> : null}
						{requests.map((request) => (
							<LocationRequestRow key={request.id} request={request} isSelected={selectedRequest?.id === request.id} onSelect={handleSelectRequest} />
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Review request</CardTitle>
						<CardDescription>Lightweight approval — no duplicate KYB required.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						{isSelectionOutOfView ? (
							<div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								<span>The linked request is not in the pending queue — it may already have been reviewed.</span>
								<Button type="button" variant="outline" size="sm" onClick={handleClearSelection}>
									Clear selection
								</Button>
							</div>
						) : null}
						{selectedRequest === undefined ? (
							isSelectionOutOfView ? null : (
								<p className="text-sm text-muted-foreground">Select a request from the queue.</p>
							)
						) : (
							<>
								<div className="space-y-3 text-sm">
									<div className="flex items-center gap-2 text-foreground">
										<Building2 className="size-4 shrink-0" aria-hidden="true" />
										<Link href={ROUTES.merchants.verificationFor(selectedRequest.tenantId)} className="font-medium hover:underline">
											{selectedRequest.tenantDisplayName}
										</Link>
									</div>
									<div className="flex items-start gap-2 text-muted-foreground">
										<MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
										<span>{selectedRequest.addressText ?? "No address provided"}</span>
									</div>
									<p className="text-muted-foreground">City: {selectedRequest.city === null ? NO_CITY_LABEL : pilotCityLabel(selectedRequest.city)}</p>
									{selectedRequest.contactPhone !== null ? <p className="text-muted-foreground">Phone: {selectedRequest.contactPhone}</p> : null}
									<p className="font-mono text-xs text-muted-foreground">Code: {selectedRequest.code}</p>
								</div>

								{/* `PATCH /admin/merchants/:id/locations/:locationId/review` requires MANAGE on MERCHANT_ORG. */}
								<Can
									permission={PERMISSION.MERCHANT_ORG.MANAGE}
									fallback={<AccessRestrictedNotice description="Approving or rejecting store requests requires the merchant tenant manage permission." />}>
									<StoreRequestReviewForm key={selectedRequest.id} isPending={reviewMutation.isPending} onReview={handleReview} />
								</Can>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
