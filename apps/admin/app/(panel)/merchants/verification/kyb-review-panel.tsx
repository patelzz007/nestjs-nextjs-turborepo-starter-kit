"use client";

import { initialDataOption, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import { Can } from "@workspace/client/lib/auth/can";
import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { MerchantKybDocumentPreviewDialog, type MerchantKybDocumentPreviewState } from "@workspace/client/lib/merchant/kyb/document-preview-dialog";
import { openExternalDocument, triggerBrowserDownload } from "@workspace/client/lib/merchant/kyb/document-utils";
import { MerchantKybStoredDocumentList } from "@workspace/client/lib/merchant/kyb/stored-document-list";
import type {
	Envelope,
	FileDownloadDisposition,
	JsonObject,
	KybStatus,
	MerchantKybDocumentRecord,
	MerchantOrgResponse,
	OrganizationLocationResponse,
	OrganizationLocationStatus,
} from "@workspace/shared";
import { EpochMsSchema, JsonPrimitiveSchema, MerchantOrgResponseSchema, nowEpochMs, PERMISSION } from "@workspace/shared";
import { z } from "zod";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Separator } from "@workspace/ui/components/display/separator";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PENDING_KYB_MERCHANTS_QUERY } from "@/lib/merchants/kyb-review";
import { toastMutationError } from "@/lib/api/mutation-error";
import { KYB_STATUS_LABELS } from "@/lib/data-table/enum-filter-options";
import { kybDocumentScanDisplay } from "@/lib/merchants/kyb-document-scan";
import { formatDateTime } from "@/lib/format/dates";
import { pilotCityLabel } from "@/lib/format/pilot-city";
import { buildKybUpdate, KybReviewFieldKeySchema, type KybReviewDecision } from "@/lib/merchants/kyb-review-form";
import { ROUTES } from "@/lib/routes";

import { KybReviewDecisionForm } from "./kyb-review-decision-form";
import { MerchantPicker } from "./merchant-picker";
import { KYB_REVIEW_URL_STATE } from "@/lib/url-state/selection";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";

/** How often the detail refetches while an uploaded document is still being virus-scanned. */
const DOCUMENT_SCAN_POLL_MS = 5_000;

const KYB_FIELD_LABELS: Readonly<Record<string, string>> = {
	registrationNo: "SSM / registration number",
	taxId: "Tax ID",
	documentType: "Document type",
	verifiedBy: "Verified by",
	rejectionReason: "Rejection reason",
	reviewedAt: "Reviewed at",
	submittedAt: "Submitted at",
	reviewNotes: "Review notes",
};

/** Payload keys shown in the decision form (or as documents) rather than as read-only fields. */
const DISPLAY_EXCLUDED_KYB_KEYS: readonly string[] = [...KybReviewFieldKeySchema.options, "documents"];

function formatKybFieldLabel(key: string): string {
	return KYB_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatKybDisplayValue(key: string, rawValue: string): string {
	if ((key === "reviewedAt" || key === "submittedAt") && rawValue.length > 0) {
		const asEpoch = EpochMsSchema.safeParse(Number(rawValue));
		if (asEpoch.success) {
			return formatDateTime(asEpoch.data);
		}
	}
	return rawValue;
}

function formatJsonFieldValue(value: JsonObject[string] | undefined): string {
	if (value === undefined) {
		return "";
	}
	const asString = z.string().safeParse(value);
	if (asString.success) {
		return asString.data;
	}
	const asPrimitive = JsonPrimitiveSchema.safeParse(value);
	if (asPrimitive.success && asPrimitive.data !== null) {
		return String(asPrimitive.data);
	}
	return JSON.stringify(value);
}

function kybStatusVariant(status: KybStatus): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED" || status === "ACTION_REQUIRED") {
		return "destructive";
	}
	return "outline";
}

function locationStatusLabel(status: OrganizationLocationStatus): string {
	if (status === "PENDING_APPROVAL") {
		return "Pending review";
	}
	if (status === "REJECTED") {
		return "Rejected";
	}
	if (status === "INACTIVE") {
		return "Inactive";
	}
	return "Active";
}

function locationStatusVariant(status: OrganizationLocationStatus): "default" | "secondary" | "outline" | "destructive" {
	if (status === "ACTIVE") {
		return "default";
	}
	if (status === "REJECTED") {
		return "destructive";
	}
	if (status === "PENDING_APPROVAL") {
		return "outline";
	}
	return "secondary";
}

interface DetailFieldProps {
	readonly label: string;
	readonly value: string | null;
	readonly mono?: boolean;
	readonly className?: string;
}

function DetailField({ label, value, mono = false, className }: DetailFieldProps): React.JSX.Element {
	const displayValue = value !== null && value.length > 0 ? value : "—";

	return (
		<div className={cn("grid min-w-0 gap-1", className)}>
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<p className={cn("text-sm [overflow-wrap:anywhere] break-words", mono ? "font-mono text-xs" : undefined)}>{displayValue}</p>
		</div>
	);
}

interface MerchantQueueItemProps {
	readonly merchant: MerchantOrgResponse;
	readonly selected: boolean;
	readonly onSelect: (organizationId: string) => void;
}

function MerchantQueueItem({ merchant, selected, onSelect }: MerchantQueueItemProps): React.JSX.Element {
	const handleClick = React.useCallback(
		function handleClick(): void {
			onSelect(merchant.id);
		},
		[merchant.id, onSelect],
	);

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"flex w-full min-w-0 flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
				selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
			)}>
			<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<p className="min-w-0 text-sm font-medium break-words">{merchant.businessName}</p>
				<Badge className="shrink-0 self-start" variant={kybStatusVariant(merchant.kybStatus)}>
					{KYB_STATUS_LABELS[merchant.kybStatus]}
				</Badge>
			</div>
			<p className="text-xs text-muted-foreground">
				{pilotCityLabel(merchant.city)} · {merchant.category}
			</p>
		</button>
	);
}

export interface KybReviewPanelProps {
	/** The API's own envelope (real pagination meta) of the pending KYB queue, prefetched on the server. */
	readonly initialPendingMerchants?: Envelope<MerchantOrgResponse[]> | undefined;
}

/**
 * KYB verification queue. The merchant open in the side panel is
 * `?organizationId=` (lib/url-state/selection) — derived from the URL on every
 * render, so a shared link, a reload and back/forward all show the same
 * merchant, and there is no second copy to keep in sync.
 */
export default function KybReviewPanel({ initialPendingMerchants }: KybReviewPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const [selection, updateSelection] = useUrlState(KYB_REVIEW_URL_STATE);
	const organizationId: string = selection.organizationId ?? "";
	const [documentPreview, setDocumentPreview] = React.useState<MerchantKybDocumentPreviewState | null>(null);

	const pendingMerchantsQuery = api.rewardsAdmin.listOrganizations.useQuery(PENDING_KYB_MERCHANTS_QUERY, initialDataOption(initialPendingMerchants));

	const merchantDetailQuery = api.rewardsAdmin.getOrganization.useQuery(
		{ organizationId },
		{
			enabled: organizationId.length > 0,
			refetchInterval: (query): number | false => {
				const documents = query.state.data?.data.documents ?? [];
				const hasPending = documents.some((document) => document.scanStatus === "SCANNING");
				return hasPending ? DOCUMENT_SCAN_POLL_MS : false;
			},
		},
	);

	const merchant = merchantDetailQuery.data?.data ?? null;

	const invalidateMerchantQueries = React.useCallback(
		async (targetOrganizationOrgId: string): Promise<void> => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getOrganization.scopeKey({ organizationId: targetOrganizationOrgId }) }),
				// Every merchant list (the pending queue and the "all merchants" list alike).
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.listOrganizations.scopeKey(undefined) }),
			]);
		},
		[queryClient],
	);

	const fetchMerchantDocumentUrl = React.useCallback(
		async (document: MerchantKybDocumentRecord, disposition: FileDownloadDisposition): Promise<string | null> => {
			if (organizationId.length === 0) {
				return null;
			}
			const response = await api.rewardsAdmin.downloadOrganizationDocument.fetchOrThrow({
				organizationId,
				documentId: document.id,
				disposition,
			});
			return response.data.downloadUrl;
		},
		[api, organizationId],
	);

	const handleViewDocument = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void (async (): Promise<void> => {
				try {
					const [viewUrl, downloadUrl] = await Promise.all([fetchMerchantDocumentUrl(document, "inline"), fetchMerchantDocumentUrl(document, "attachment")]);
					if (viewUrl === null || downloadUrl === null) {
						toastMessage.error({ title: "Document unavailable", description: "This document is still scanning or was rejected." });
						return;
					}
					setDocumentPreview({
						fileName: document.fileName,
						mimeType: document.mimeType,
						viewUrl,
						downloadUrl,
					});
				} catch (error) {
					const description = error instanceof Error ? error.message : "Could not open document.";
					toastMessage.error({ title: "Preview failed", description });
				}
			})();
		},
		[fetchMerchantDocumentUrl],
	);

	const handleDownloadDocument = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void (async (): Promise<void> => {
				try {
					const downloadUrl = await fetchMerchantDocumentUrl(document, "attachment");
					if (downloadUrl === null) {
						toastMessage.error({ title: "Document unavailable", description: "This document is still scanning or was rejected." });
						return;
					}
					triggerBrowserDownload(downloadUrl, document.fileName);
				} catch (error) {
					const description = error instanceof Error ? error.message : "Download failed.";
					toastMessage.error({ title: "Download failed", description });
				}
			})();
		},
		[fetchMerchantDocumentUrl],
	);

	const handleViewDocumentSource = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void (async (): Promise<void> => {
				try {
					const viewUrl = await fetchMerchantDocumentUrl(document, "inline");
					if (viewUrl === null) {
						toastMessage.error({ title: "Document unavailable", description: "This document is still scanning or was rejected." });
						return;
					}
					openExternalDocument(viewUrl);
				} catch (error) {
					const description = error instanceof Error ? error.message : "Could not open document.";
					toastMessage.error({ title: "View source failed", description });
				}
			})();
		},
		[fetchMerchantDocumentUrl],
	);

	const handleCloseDocumentPreview = React.useCallback(function handleCloseDocumentPreview(): void {
		setDocumentPreview(null);
	}, []);

	const updateKyb = api.rewardsAdmin.updateKyb.useMutation({
		onSuccess: async (_data, variables) => {
			toastMessage.success({ title: "KYB updated", description: "Merchant verification status saved." });
			await invalidateMerchantQueries(variables.organizationId);
		},
		onError: (error) => {
			toastMutationError("KYB update failed", error);
		},
	});

	const pendingMerchants = pendingMerchantsQuery.data?.data ?? [];
	// The server's count of every pending merchant — the queue shows only its first page.
	const pendingTotal: number = readPaginatedTotal(pendingMerchantsQuery.data?.meta);

	const handleMerchantSelect = React.useCallback(
		function handleMerchantSelect(value: string | null): void {
			// A cleared picker clears the selection; anything else must be a merchant id.
			const parsed = MerchantOrgResponseSchema.shape.id.safeParse(value);
			updateSelection({ organizationId: parsed.success ? parsed.data : undefined });
		},
		[updateSelection],
	);

	const handleSubmitReview = React.useCallback(
		function handleSubmitReview(decision: KybReviewDecision): void {
			if (merchant === null) {
				return;
			}
			updateKyb.mutate({ organizationId: merchant.id, ...buildKybUpdate(merchant.kybFields, decision, nowEpochMs()) });
		},
		[merchant, updateKyb],
	);

	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">KYB review</h1>
					<p className="text-sm text-muted-foreground">Review merchant business details, verification documents, and approval status.</p>
				</div>
				<Link href={ROUTES.merchants.list} className={buttonVariants({ variant: "outline" })}>
					View all merchants
				</Link>
			</header>

			<div className="grid min-w-0 gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<Card className="h-fit">
					<CardHeader>
						<CardTitle className="text-base">Pending queue</CardTitle>
						<CardDescription>
							{pendingTotal} merchant{pendingTotal === 1 ? "" : "s"} awaiting verification
							{pendingTotal > pendingMerchants.length ? ` — showing the oldest ${String(pendingMerchants.length)}` : ""}
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-2">
						{pendingMerchantsQuery.isLoading ? (
							<div className="grid gap-2">
								<Skeleton className="h-16 w-full rounded-xl" />
								<Skeleton className="h-16 w-full rounded-xl" />
							</div>
						) : null}
						{!pendingMerchantsQuery.isLoading && pendingMerchants.length === 0 ? (
							<p className="text-sm text-muted-foreground">No merchants are currently pending KYB review.</p>
						) : null}
						{pendingMerchants.map((item) => (
							<MerchantQueueItem key={item.id} merchant={item} selected={item.id === organizationId} onSelect={handleMerchantSelect} />
						))}
					</CardContent>
				</Card>

				<div className="grid min-w-0 gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Select merchant</CardTitle>
							<CardDescription>Pick any merchant organization to inspect or update KYB.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<Label htmlFor="kyb-merchant-select">Merchant organization</Label>
								<MerchantPicker id="kyb-merchant-select" value={organizationId} onChange={handleMerchantSelect} selectedName={merchant?.businessName} />
							</div>
						</CardContent>
					</Card>

					{organizationId.length === 0 ? (
						<Card>
							<CardContent className="py-10 text-center text-sm text-muted-foreground">Select a merchant to load KYB details.</CardContent>
						</Card>
					) : null}

					{organizationId.length > 0 && merchantDetailQuery.isLoading ? (
						<Card>
							<CardContent className="grid gap-4 py-6">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-24 w-full" />
							</CardContent>
						</Card>
					) : null}

					{organizationId.length > 0 && merchantDetailQuery.isError ? (
						<Card>
							<CardContent className="py-10 text-center text-sm text-destructive">Could not load merchant details. Check the org ID and try again.</CardContent>
						</Card>
					) : null}

					{merchant !== null ? (
						<>
							<Card>
								<CardHeader>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0">
											<CardTitle className="break-words">{merchant.businessName}</CardTitle>
											<CardDescription className="break-words">{merchant.legalName ?? "Legal name not provided"}</CardDescription>
										</div>
										<div className="flex shrink-0 flex-wrap gap-2">
											<Badge variant={kybStatusVariant(merchant.kybStatus)}>{KYB_STATUS_LABELS[merchant.kybStatus]}</Badge>
											<Badge variant="secondary">{merchant.status}</Badge>
										</div>
									</div>
								</CardHeader>
								<CardContent className="grid min-w-0 gap-6">
									<div className="grid gap-4">
										<DetailField label="Organization ID" value={merchant.id} mono />
										<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
											<DetailField label="Pilot city" value={pilotCityLabel(merchant.city)} />
											<DetailField label="Team members" value={String(merchant.memberCount)} />
											<DetailField label="Last updated" value={formatDateTime(merchant.updatedAt)} />
										</div>
									</div>

									<Separator />

									<div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-6">
										<div className="grid min-w-0 gap-4">
											<div className="flex items-center gap-2 text-sm font-medium">
												<Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
												Business profile
											</div>
											<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
												<DetailField label="Trading name" value={merchant.businessName} />
												<DetailField label="Legal name" value={merchant.legalName} />
												<DetailField label="Category" value={merchant.category} />
											</div>
										</div>

										<div className="grid min-w-0 gap-4">
											<div className="flex items-center gap-2 text-sm font-medium">
												<User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
												Contact & owner
											</div>
											<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
												<DetailField className="md:col-span-2" label="Contact email" value={merchant.contactEmail} mono />
												<DetailField label="Contact phone" value={merchant.contactPhone} />
												<DetailField label="Owner name" value={merchant.ownerFullName} />
												<DetailField className="md:col-span-2" label="Owner email" value={merchant.ownerEmail} mono />
											</div>
										</div>
									</div>

									<Separator />

									<div className="grid min-w-0 gap-4">
										<div className="flex items-center gap-2 text-sm font-medium">
											<MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
											Store locations
										</div>
										{merchant.locations.length === 0 ? (
											<p className="text-sm text-muted-foreground">No store locations have been submitted yet.</p>
										) : (
											<div className="grid gap-4">
												{merchant.locations.map((location: OrganizationLocationResponse) => (
													<div key={location.id} className="rounded-lg border border-border p-4">
														<div className="flex flex-wrap items-center gap-2">
															<p className="font-medium text-foreground">{location.name}</p>
															{location.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
															<Badge variant={locationStatusVariant(location.status)}>{locationStatusLabel(location.status)}</Badge>
														</div>
														<p className="mt-2 text-sm text-muted-foreground">{location.addressText ?? "No address provided"}</p>
														<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
															{location.city !== null ? <span>{pilotCityLabel(location.city)}</span> : null}
															{location.contactPhone !== null && location.contactPhone.length > 0 ? <span>{location.contactPhone}</span> : null}
															<span className="font-mono">{location.code}</span>
														</div>
														{location.rejectionReason !== null && location.rejectionReason.length > 0 ? (
															<p className="mt-2 text-sm text-destructive">Rejection reason: {location.rejectionReason}</p>
														) : null}
													</div>
												))}
											</div>
										)}
									</div>

									<Separator />

									<div className="grid min-w-0 gap-4">
										<div className="flex items-center gap-2 text-sm font-medium">
											<MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
											Submitted verification data
										</div>
										{merchant.kybFields === null ? (
											<p className="text-sm text-muted-foreground">No KYB payload has been submitted yet.</p>
										) : (
											<div className="space-y-4">
												<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
													{Object.entries(merchant.kybFields)
														.filter(([key]) => !DISPLAY_EXCLUDED_KYB_KEYS.includes(key))
														.map(([key, value]) => (
															<DetailField
																key={key}
																label={formatKybFieldLabel(key)}
																value={formatKybDisplayValue(key, formatJsonFieldValue(value))}
																mono={key === "reviewedAt" || key === "submittedAt"}
															/>
														))}
												</div>
												{merchant.documents.length > 0 ? (
													<div className="space-y-2">
														<p className="text-sm font-medium">Uploaded documents</p>
														<ul aria-label="Document scan status" className="grid gap-2">
															{merchant.documents.map((document) => {
																const scan = kybDocumentScanDisplay(document.scanStatus);
																return (
																	<li key={document.id} className="flex flex-wrap items-center gap-2 text-sm">
																		<span className="min-w-0 break-all">{document.fileName}</span>
																		<Badge variant={scan.variant} title={scan.description}>
																			{scan.label}
																		</Badge>
																	</li>
																);
															})}
														</ul>
														<MerchantKybStoredDocumentList
															documents={merchant.documents}
															onView={handleViewDocument}
															onDownload={handleDownloadDocument}
															onViewSource={handleViewDocumentSource}
														/>
													</div>
												) : null}
											</div>
										)}
									</div>

									<div className="flex items-start gap-2 text-xs text-muted-foreground">
										<Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
										<span className="break-words">Onboarded {formatDateTime(merchant.createdAt)}</span>
									</div>
								</CardContent>
							</Card>

							{/* `PATCH /admin/merchants/:id/kyb` requires MANAGE on MERCHANT_ORG; viewing needs only LIST. */}
							<Can
								permission={PERMISSION.MERCHANT_ORG.MANAGE}
								fallback={<AccessRestrictedNotice description="Updating a merchant's KYB status requires the merchant organization manage permission." />}>
								<KybReviewDecisionForm
									key={`${merchant.id}-${String(merchant.updatedAt)}`}
									kybStatus={merchant.kybStatus}
									kybFields={merchant.kybFields}
									isSaving={updateKyb.isPending}
									onSubmitReview={handleSubmitReview}
								/>
							</Can>
						</>
					) : null}
				</div>
			</div>
			<MerchantKybDocumentPreviewDialog preview={documentPreview} onClose={handleCloseDocumentPreview} />
		</div>
	);
}
