"use client";

import { initialDataOption, stubPaginatedMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { Can } from "@workspace/client/lib/auth/can";
import { AdminLocationRequestResponseSchema, PERMISSION, type AdminLocationRequestResponse } from "@workspace/shared";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, MapPin, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ROUTES } from "@/lib/routes";
import { STORE_REQUESTS_URL_STATE } from "@/lib/url-state/selection";

const CITY_LABELS: Record<string, string> = {
	KUALA_LUMPUR: "Kuala Lumpur",
	MELAKA: "Melaka",
};

function formatCity(city: string | null): string {
	if (city === null) {
		return "—";
	}
	return CITY_LABELS[city] ?? city.replaceAll("_", " ");
}

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
					<p className="text-sm text-muted-foreground">{request.organizationDisplayName}</p>
				</div>
				<Badge variant="outline">Pending</Badge>
			</div>
		</button>
	);
}

export interface LocationRequestsPanelProps {
	readonly initialPendingRequests?: readonly AdminLocationRequestResponse[] | undefined;
}

/**
 * Store location request queue. The request open in the review panel is
 * `?requestId=` (lib/url-state/selection); without one — or once it has been
 * reviewed and left the queue — the first pending request is shown.
 */
export default function LocationRequestsPanel({ initialPendingRequests }: LocationRequestsPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [selection, updateSelection] = useUrlState(STORE_REQUESTS_URL_STATE);
	const [rejectionReason, setRejectionReason] = React.useState("");

	const pendingInitialData = React.useMemo(
		() => (initialPendingRequests !== undefined ? successEnvelope([...initialPendingRequests], stubPaginatedMeta(50, initialPendingRequests.length, 1, 1, false)) : undefined),
		[initialPendingRequests],
	);

	const requestsQuery = api.rewardsAdmin.listLocationRequests.useQuery(
		{ page: 1, limit: 50, filter: { status: { eq: "PENDING_APPROVAL" } } },
		initialDataOption(pendingInitialData),
	);

	const reviewMutation = api.rewardsAdmin.reviewOrganizationLocation.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Store request updated" });
			setRejectionReason("");
			await queryClient.invalidateQueries();
		},
		onError: (): void => {
			toastMessage.error({ title: "Could not update store request" });
		},
	});

	const requests = requestsQuery.data?.data ?? [];
	const selectedRequest = requests.find((request) => request.id === selection.requestId) ?? requests[0];

	const handleApprove = React.useCallback((): void => {
		if (selectedRequest === undefined) {
			return;
		}
		reviewMutation.mutate({
			organizationId: selectedRequest.organizationId,
			locationId: selectedRequest.id,
			approve: true,
		});
	}, [reviewMutation, selectedRequest]);

	const handleReject = React.useCallback((): void => {
		if (selectedRequest === undefined) {
			return;
		}
		if (rejectionReason.trim().length === 0) {
			toastMessage.error({ title: "Add a rejection reason" });
			return;
		}
		reviewMutation.mutate({
			organizationId: selectedRequest.organizationId,
			locationId: selectedRequest.id,
			approve: false,
			rejectionReason: rejectionReason.trim(),
		});
	}, [rejectionReason, reviewMutation, selectedRequest]);

	const handleSelectRequest = React.useCallback(
		(requestId: string): void => {
			const parsed = AdminLocationRequestResponseSchema.shape.id.safeParse(requestId);
			if (parsed.success) {
				updateSelection({ requestId: parsed.data });
			}
		},
		[updateSelection],
	);

	const handleRejectionReasonChange = React.useCallback(function handleRejectionReasonChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
		setRejectionReason(event.target.value);
	}, []);

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
							{String(requests.length)} request{requests.length === 1 ? "" : "s"} awaiting review
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{requestsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
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
						{selectedRequest === undefined ? (
							<p className="text-sm text-muted-foreground">Select a request from the queue.</p>
						) : (
							<>
								<div className="space-y-3 text-sm">
									<div className="flex items-center gap-2 text-foreground">
										<Building2 className="size-4 shrink-0" aria-hidden="true" />
										<Link href={ROUTES.merchants.verificationFor(selectedRequest.organizationId)} className="font-medium hover:underline">
											{selectedRequest.organizationDisplayName}
										</Link>
									</div>
									<div className="flex items-start gap-2 text-muted-foreground">
										<MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
										<span>{selectedRequest.addressText ?? "No address provided"}</span>
									</div>
									<p className="text-muted-foreground">City: {formatCity(selectedRequest.city)}</p>
									{selectedRequest.contactPhone !== null ? <p className="text-muted-foreground">Phone: {selectedRequest.contactPhone}</p> : null}
									<p className="font-mono text-xs text-muted-foreground">Code: {selectedRequest.code}</p>
								</div>

								{/* `PATCH /admin/merchants/:id/locations/:locationId/review` requires MANAGE on MERCHANT_ORG. */}
								<Can
									permission={PERMISSION.MERCHANT_ORG.MANAGE}
									fallback={<AccessRestrictedNotice description="Approving or rejecting store requests requires the merchant organization manage permission." />}>
									<div className="space-y-2">
										<Label htmlFor="rejection-reason">Rejection reason</Label>
										<Textarea id="rejection-reason" value={rejectionReason} onChange={handleRejectionReasonChange} placeholder="Required only when rejecting" rows={3} />
									</div>

									<div className="flex flex-wrap gap-2">
										<Button type="button" onClick={handleApprove} disabled={reviewMutation.isPending}>
											<Check className="size-4" aria-hidden="true" />
											Approve store
										</Button>
										<Button type="button" variant="destructive" onClick={handleReject} disabled={reviewMutation.isPending}>
											<X className="size-4" aria-hidden="true" />
											Reject
										</Button>
									</div>
								</Can>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
