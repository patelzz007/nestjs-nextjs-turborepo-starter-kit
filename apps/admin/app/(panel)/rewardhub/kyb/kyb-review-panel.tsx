"use client";

import { stubPaginatedMeta } from "@/lib/api-envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import { buildKybDocumentDataUrl, formatKybDocumentSize, readStoredKybDocuments } from "@workspace/client/lib/auth/merchant-kyb-document-utils";
import type { AdminMerchantDetailResponse, JsonObject, JsonValue, KybStatus, MerchantOrgResponse } from "@workspace/shared";
import { EpochMsSchema, JsonObjectSchema, JsonPrimitiveSchema, KybStatusSchema, nowEpochMs } from "@workspace/shared";
import { z } from "zod";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Separator } from "@workspace/ui/components/display/separator";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Clock, MapPin, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const KYB_STATUSES: readonly KybStatus[] = KybStatusSchema.options;

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

const FORM_KYB_KEYS: readonly string[] = ["registrationNo", "taxId", "documentType", "reviewNotes", "rejectionReason"];
const DISPLAY_EXCLUDED_KYB_KEYS: readonly string[] = [...FORM_KYB_KEYS, "documents"];

function formatPilotCity(city: string): string {
	return city.replaceAll("_", " ");
}

function formatEpochMs(value: number): string {
	return new Date(value).toLocaleString();
}

function formatKybFieldLabel(key: string): string {
	return KYB_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatKybDisplayValue(key: string, rawValue: string): string {
	if ((key === "reviewedAt" || key === "submittedAt") && rawValue.length > 0) {
		const asEpoch = EpochMsSchema.safeParse(Number(rawValue));
		if (asEpoch.success) {
			return new Date(asEpoch.data).toLocaleString();
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

function readKybStringField(kybFields: JsonObject | null, key: string): string {
	if (kybFields === null) {
		return "";
	}
	return formatJsonFieldValue(kybFields[key]);
}

function kybStatusVariant(status: KybStatus): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED") {
		return "destructive";
	}
	return "outline";
}

function buildKybFieldsPayload(
	baseFields: JsonObject | null,
	input: {
		readonly registrationNo: string;
		readonly taxId: string;
		readonly documentType: string;
		readonly reviewNotes: string;
		readonly rejectionReason: string;
		readonly kybStatus: KybStatus;
	},
): JsonObject {
	const draft: Record<string, JsonValue> = {};

	if (baseFields !== null) {
		for (const [key, value] of Object.entries(baseFields)) {
			if (!FORM_KYB_KEYS.includes(key) && key !== "reviewedAt") {
				draft[key] = value;
			}
		}
	}

	const assignIfPresent = (key: string, value: string): void => {
		const trimmed = value.trim();
		if (trimmed.length > 0) {
			draft[key] = trimmed;
		}
	};

	assignIfPresent("registrationNo", input.registrationNo);
	assignIfPresent("taxId", input.taxId);
	assignIfPresent("documentType", input.documentType);
	assignIfPresent("reviewNotes", input.reviewNotes);
	assignIfPresent("rejectionReason", input.rejectionReason);
	draft.reviewedAt = nowEpochMs();

	if (input.kybStatus === "REJECTED" && input.rejectionReason.trim().length === 0) {
		draft.rejectionReason = "Rejected during KYB review.";
	}

	const validated = JsonObjectSchema.safeParse(draft);
	if (!validated.success) {
		return { reviewedAt: nowEpochMs() };
	}

	return validated.data;
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
	readonly onSelect: (merchantOrgId: string) => void;
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
					{merchant.kybStatus}
				</Badge>
			</div>
			<p className="text-xs text-muted-foreground">
				{formatPilotCity(merchant.city)} · {merchant.category}
			</p>
		</button>
	);
}

interface KybReviewDecisionFormProps {
	readonly merchant: AdminMerchantDetailResponse;
	readonly isSaving: boolean;
	readonly onSubmitReview: (input: {
		readonly kybStatus: KybStatus;
		readonly registrationNo: string;
		readonly taxId: string;
		readonly documentType: string;
		readonly reviewNotes: string;
		readonly rejectionReason: string;
	}) => void;
}

function KybReviewDecisionForm({ merchant, isSaving, onSubmitReview }: KybReviewDecisionFormProps): React.JSX.Element {
	const [kybStatus, setKybStatus] = React.useState<KybStatus>(merchant.kybStatus);
	const [registrationNo, setRegistrationNo] = React.useState<string>(() => readKybStringField(merchant.kybFields, "registrationNo"));
	const [taxId, setTaxId] = React.useState<string>(() => readKybStringField(merchant.kybFields, "taxId"));
	const [documentType, setDocumentType] = React.useState<string>(() => readKybStringField(merchant.kybFields, "documentType"));
	const [reviewNotes, setReviewNotes] = React.useState<string>(() => readKybStringField(merchant.kybFields, "reviewNotes"));
	const [rejectionReason, setRejectionReason] = React.useState<string>(() => readKybStringField(merchant.kybFields, "rejectionReason"));

	const handleKybStatusChange = React.useCallback(function handleKybStatusChange(value: string | null): void {
		const parsed = KybStatusSchema.safeParse(value);
		if (parsed.success) {
			setKybStatus(parsed.data);
		}
	}, []);

	const handleRegistrationNoChange = React.useCallback(function handleRegistrationNoChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setRegistrationNo(event.target.value);
	}, []);

	const handleTaxIdChange = React.useCallback(function handleTaxIdChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setTaxId(event.target.value);
	}, []);

	const handleDocumentTypeChange = React.useCallback(function handleDocumentTypeChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setDocumentType(event.target.value);
	}, []);

	const handleReviewNotesChange = React.useCallback(function handleReviewNotesChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
		setReviewNotes(event.target.value);
	}, []);

	const handleRejectionReasonChange = React.useCallback(function handleRejectionReasonChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
		setRejectionReason(event.target.value);
	}, []);

	const submitReview = React.useCallback(
		function submitReview(nextStatus: KybStatus): void {
			onSubmitReview({
				kybStatus: nextStatus,
				registrationNo,
				taxId,
				documentType,
				reviewNotes,
				rejectionReason,
			});
		},
		[documentType, onSubmitReview, registrationNo, rejectionReason, reviewNotes, taxId],
	);

	const handleSubmit = React.useCallback(
		function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
			event.preventDefault();
			submitReview(kybStatus);
		},
		[kybStatus, submitReview],
	);

	const handleApprove = React.useCallback(
		function handleApprove(): void {
			setKybStatus("APPROVED");
			submitReview("APPROVED");
		},
		[submitReview],
	);

	const handleReject = React.useCallback(
		function handleReject(): void {
			setKybStatus("REJECTED");
			submitReview("REJECTED");
		},
		[submitReview],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Review decision</CardTitle>
				<CardDescription>Update verification fields, add notes, and approve or reject the merchant.</CardDescription>
			</CardHeader>
			<CardContent className="min-w-0">
				<form className="grid min-w-0 gap-6" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="kyb-registration-no">SSM / registration number</Label>
							<Input id="kyb-registration-no" value={registrationNo} onChange={handleRegistrationNoChange} placeholder="201901012345" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-tax-id">Tax ID</Label>
							<Input id="kyb-tax-id" value={taxId} onChange={handleTaxIdChange} placeholder="C12345678" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-document-type">Document type</Label>
							<Input id="kyb-document-type" value={documentType} onChange={handleDocumentTypeChange} placeholder="SSM certificate" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-status">KYB status</Label>
							<Select value={kybStatus} onValueChange={handleKybStatusChange}>
								<SelectTrigger id="kyb-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{KYB_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="kyb-review-notes">Internal review notes</Label>
						<Textarea id="kyb-review-notes" value={reviewNotes} onChange={handleReviewNotesChange} placeholder="Notes for other admins (stored in KYB payload)." rows={3} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="kyb-rejection-reason">Rejection reason</Label>
						<Textarea
							id="kyb-rejection-reason"
							value={rejectionReason}
							onChange={handleRejectionReasonChange}
							placeholder="Required context when rejecting — shared with the merchant team via KYB payload."
							rows={3}
						/>
					</div>

					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
						<Button type="submit" disabled={isSaving}>
							<ShieldCheck className="mr-2 size-4" aria-hidden="true" />
							{isSaving ? "Saving…" : "Save review"}
						</Button>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Button type="button" variant="outline" disabled={isSaving} onClick={handleReject}>
								<X className="mr-2 size-4" aria-hidden="true" />
								Reject
							</Button>
							<Button type="button" disabled={isSaving} onClick={handleApprove}>
								<Check className="mr-2 size-4" aria-hidden="true" />
								Approve
							</Button>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export interface KybReviewPanelProps {
	readonly initialMerchantOrgId?: string;
	readonly initialPendingMerchants?: readonly MerchantOrgResponse[];
}

export default function KybReviewPanel({ initialMerchantOrgId, initialPendingMerchants }: KybReviewPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();

	const [merchantOrgId, setMerchantOrgId] = React.useState<string>(initialMerchantOrgId ?? "");

	const pendingInitialData = React.useMemo(
		() =>
			initialPendingMerchants !== undefined
				? {
						success: true as const,
						data: [...initialPendingMerchants],
						meta: stubPaginatedMeta(50, initialPendingMerchants.length, 1, 1, false),
					}
				: undefined,
		[initialPendingMerchants],
	);

	const pendingMerchantsQuery = api.rewardsAdmin.listMerchants.useQuery({ page: 1, limit: 50, kybStatus: "PENDING" }, { initialData: pendingInitialData });

	const allMerchantsQuery = api.rewardsAdmin.listMerchants.useQuery({ page: 1, limit: 100 });

	const merchantDetailQuery = api.rewardsAdmin.getMerchant.useQuery({ merchantOrgId }, { enabled: merchantOrgId.length > 0 });

	const merchant = merchantDetailQuery.data?.data ?? null;

	const invalidateMerchantQueries = React.useCallback(
		async (targetMerchantOrgId: string): Promise<void> => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getMerchant.queryKey({ merchantOrgId: targetMerchantOrgId }) }),
				queryClient.invalidateQueries({ queryKey: ["rewards-admin", "merchants"] }),
			]);
		},
		[queryClient],
	);

	const updateKyb = api.rewardsAdmin.updateKyb.useMutation({
		onSuccess: async (_data, variables) => {
			toastMessage.success({ title: "KYB updated", description: "Merchant verification status saved." });
			await invalidateMerchantQueries(variables.merchantOrgId);
		},
		onError: (error) => {
			toastMessage.error({ title: "KYB update failed", description: error.message });
		},
	});

	const pendingMerchants = pendingMerchantsQuery.data?.data ?? [];
	const allMerchants = allMerchantsQuery.data?.data ?? [];

	const handleMerchantSelect = React.useCallback(
		function handleMerchantSelect(value: string | null): void {
			if (value === null || value.length === 0) {
				return;
			}
			setMerchantOrgId(value);
			router.replace(`/rewardhub/kyb?merchantOrgId=${value}`);
		},
		[router],
	);

	const handleSubmitReview = React.useCallback(
		function handleSubmitReview(input: {
			readonly kybStatus: KybStatus;
			readonly registrationNo: string;
			readonly taxId: string;
			readonly documentType: string;
			readonly reviewNotes: string;
			readonly rejectionReason: string;
		}): void {
			if (merchantOrgId.length === 0 || merchant === null) {
				toastMessage.error({ title: "Select a merchant", description: "Choose a merchant from the queue or dropdown." });
				return;
			}

			const kybFields = buildKybFieldsPayload(merchant.kybFields, {
				registrationNo: input.registrationNo,
				taxId: input.taxId,
				documentType: input.documentType,
				reviewNotes: input.reviewNotes,
				rejectionReason: input.rejectionReason,
				kybStatus: input.kybStatus,
			});

			updateKyb.mutate({
				merchantOrgId,
				kybStatus: input.kybStatus,
				kybFields,
			});
		},
		[merchant, merchantOrgId, updateKyb],
	);

	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">KYB review</h1>
					<p className="text-sm text-muted-foreground">Review merchant business details, verification documents, and approval status.</p>
				</div>
				<Button variant="outline" nativeButton={false} render={<Link href="/rewardhub/merchants" />}>
					View all merchants
				</Button>
			</header>

			<div className="grid min-w-0 gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<Card className="h-fit">
					<CardHeader>
						<CardTitle className="text-base">Pending queue</CardTitle>
						<CardDescription>{pendingMerchants.length} merchant(s) awaiting verification</CardDescription>
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
							<MerchantQueueItem key={item.id} merchant={item} selected={item.id === merchantOrgId} onSelect={handleMerchantSelect} />
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
								<Select value={merchantOrgId.length > 0 ? merchantOrgId : null} onValueChange={handleMerchantSelect}>
									<SelectTrigger id="kyb-merchant-select">
										<SelectValue placeholder="Choose a merchant" />
									</SelectTrigger>
									<SelectContent>
										{allMerchants.map((item) => (
											<SelectItem key={item.id} value={item.id}>
												{item.businessName} ({item.kybStatus})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					{merchantOrgId.length === 0 ? (
						<Card>
							<CardContent className="py-10 text-center text-sm text-muted-foreground">Select a merchant to load KYB details.</CardContent>
						</Card>
					) : null}

					{merchantOrgId.length > 0 && merchantDetailQuery.isLoading ? (
						<Card>
							<CardContent className="grid gap-4 py-6">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-24 w-full" />
							</CardContent>
						</Card>
					) : null}

					{merchantOrgId.length > 0 && merchantDetailQuery.isError ? (
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
											<Badge variant={kybStatusVariant(merchant.kybStatus)}>{merchant.kybStatus}</Badge>
											<Badge variant="secondary">{merchant.status}</Badge>
										</div>
									</div>
								</CardHeader>
								<CardContent className="grid min-w-0 gap-6">
									<div className="grid gap-4">
										<DetailField label="Organization ID" value={merchant.id} mono />
										<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
											<DetailField label="Pilot city" value={formatPilotCity(merchant.city)} />
											<DetailField label="Team members" value={String(merchant.memberCount)} />
											<DetailField label="Last updated" value={formatEpochMs(merchant.updatedAt)} />
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
												<DetailField className="md:col-span-2" label="Address" value={merchant.addressText} />
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
												{readStoredKybDocuments(merchant.kybFields).length > 0 ? (
													<div className="space-y-2">
														<p className="text-sm font-medium">Uploaded documents</p>
														<ul className="space-y-2">
															{readStoredKybDocuments(merchant.kybFields).map((document) => (
																<li
																	key={`${document.fileName}-${String(document.uploadedAt)}`}
																	className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
																	<a href={buildKybDocumentDataUrl(document)} download={document.fileName} className="truncate font-medium text-primary hover:underline">
																		{document.fileName}
																	</a>
																	<span className="shrink-0 text-muted-foreground">{formatKybDocumentSize(document.sizeBytes)}</span>
																</li>
															))}
														</ul>
													</div>
												) : null}
											</div>
										)}
									</div>

									<div className="flex items-start gap-2 text-xs text-muted-foreground">
										<Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
										<span className="break-words">Onboarded {formatEpochMs(merchant.createdAt)}</span>
									</div>
								</CardContent>
							</Card>

							<KybReviewDecisionForm
								key={`${merchant.id}-${String(merchant.updatedAt)}`}
								merchant={merchant}
								isSaving={updateKyb.isPending}
								onSubmitReview={handleSubmitReview}
							/>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
