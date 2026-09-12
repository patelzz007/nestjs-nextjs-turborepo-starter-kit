"use client";

import type { FileDownloadDisposition, MerchantKybDocumentRecord, MerchantKybProfileResponse } from "@workspace/shared";
import {
	JsonPrimitiveSchema,
	MERCHANT_KYB_MAX_DOCUMENT_COUNT,
	MerchantKybBusinessFieldsSchema,
	MerchantKybRegistrationFieldsSchema,
	MerchantKybSubmissionFormSchema,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { z } from "zod";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { MERCHANT_ME_QUERY_KEY } from "./invalidate-session-auth";
import { hasSubmittedMerchantKyb, openExternalDocument, readProfileKybDocuments, triggerBrowserDownload } from "./merchant-kyb-document-utils";
import { MerchantKybDocumentPreviewDialog, type MerchantKybDocumentPreviewState } from "./merchant-kyb-document-preview-dialog";
import { MerchantKybDocumentUpload } from "./merchant-kyb-document-upload";
import { submitMerchantKyb } from "./merchant-kyb-multipart";
import { MerchantKybStoredDocumentList } from "./merchant-kyb-stored-document-list";
import { MerchantKybBusinessFields, MerchantKybRegistrationFields, type MerchantKybFieldValues } from "./merchant-kyb-fields";
import { MerchantOnboardingStepper, type MerchantOnboardingStep } from "./merchant-onboarding-stepper";

const NonEmptyStringSchema = z.string().min(1);

const UPDATE_STEPS: readonly MerchantOnboardingStep[] = [
	{ id: "business", label: "Business", description: "Registered details" },
	{ id: "registration", label: "Registration", description: "SSM & tax ID" },
	{ id: "documents", label: "Documents", description: "Upload certificates" },
];

type UpdateStep = "business" | "registration" | "documents";

function readOrgString(value: string | null): string {
	const parsed = NonEmptyStringSchema.safeParse(value);
	return parsed.success ? parsed.data : "";
}

function readKybStringField(profile: MerchantKybProfileResponse, key: string): string {
	if (profile.kybFields === null) {
		return "";
	}
	const parsed = JsonPrimitiveSchema.safeParse(profile.kybFields[key]);
	if (!parsed.success || parsed.data === null) {
		return "";
	}
	return String(parsed.data);
}

function profileToFieldValues(profile: MerchantKybProfileResponse): MerchantKybFieldValues {
	return {
		businessName: profile.businessName,
		legalName: readOrgString(profile.legalName),
		addressText: readOrgString(profile.addressText),
		contactPhone: readOrgString(profile.contactPhone),
		registrationNo: readKybStringField(profile, "registrationNo"),
		taxId: readKybStringField(profile, "taxId"),
		documentType: readKybStringField(profile, "documentType"),
		documents: [],
	};
}

function kybStatusVariant(status: MerchantKybProfileResponse["kybStatus"]): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED" || status === "ACTION_REQUIRED") {
		return "destructive";
	}
	return "outline";
}

export function MerchantKybVerificationView(): React.JSX.Element {
	const { api } = useAuth();
	const profileQuery = api.merchant.kyb.get.useQuery(
		{},
		{
			staleTime: 0,
			refetchInterval: (query): number | false => {
				const documents = query.state.data?.data.documents ?? [];
				const hasPending = documents.some((document) => document.scanStatus === "SCANNING");
				return hasPending ? 5_000 : false;
			},
		},
	);
	const profile = profileQuery.data?.data;

	if (profileQuery.isLoading && profile === undefined) {
		return <p className="text-sm text-muted-foreground">Loading business verification…</p>;
	}

	if (profile === undefined) {
		return <p className="text-sm text-destructive">Unable to load business verification details.</p>;
	}

	return <MerchantKybVerificationContent profile={profile} />;
}

interface MerchantKybVerificationContentProps {
	readonly profile: MerchantKybProfileResponse;
}

function MerchantKybVerificationContent({ profile }: MerchantKybVerificationContentProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const hasSubmitted = hasSubmittedMerchantKyb(profile);
	const isApproved = profile.kybStatus === "APPROVED";
	const canUpdate = !isApproved;
	const storedDocuments = readProfileKybDocuments(profile);

	const [step, setStep] = React.useState<UpdateStep>("business");
	const [values, setValues] = React.useState<MerchantKybFieldValues>(() => profileToFieldValues(profile));
	const [error, setError] = React.useState<string | null>(null);
	const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [documentPreview, setDocumentPreview] = React.useState<MerchantKybDocumentPreviewState | null>(null);

	const completedStepIds = React.useMemo((): ReadonlySet<string> => {
		const completed = new Set<string>();
		if (step === "registration" || step === "documents") {
			completed.add("business");
		}
		if (step === "documents") {
			completed.add("registration");
		}
		return completed;
	}, [step]);

	const handleBusinessFieldChange = React.useCallback((field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleRegistrationFieldChange = React.useCallback((field: "registrationNo" | "taxId" | "documentType", value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleDocumentsChange = React.useCallback((documents: MerchantKybFieldValues["documents"]): void => {
		setValues((current) => ({ ...current, documents }));
	}, []);

	const fetchStoredDocumentUrl = React.useCallback(
		async (document: MerchantKybDocumentRecord, disposition: FileDownloadDisposition): Promise<string | null> => {
			const response = await api.merchant.kyb.downloadDocument.fetchOrThrow({ documentId: document.id, disposition });
			return response.data.downloadUrl;
		},
		[api],
	);

	const handleCloseDocumentPreview = React.useCallback((): void => {
		setDocumentPreview(null);
	}, []);

	const handleViewStoredDocument = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void Promise.all([fetchStoredDocumentUrl(document, "inline"), fetchStoredDocumentUrl(document, "attachment")])
				.then(([viewUrl, downloadUrl]): void => {
					if (viewUrl === null || downloadUrl === null) {
						setError("This document is still scanning or was rejected.");
						return;
					}
					setDocumentPreview({
						fileName: document.fileName,
						mimeType: document.mimeType,
						viewUrl,
						downloadUrl,
					});
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[fetchStoredDocumentUrl],
	);

	const handleDownloadStoredDocument = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void fetchStoredDocumentUrl(document, "attachment")
				.then((downloadUrl): void => {
					if (downloadUrl === null) {
						setError("This document is still scanning or was rejected.");
						return;
					}
					triggerBrowserDownload(downloadUrl, document.fileName);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[fetchStoredDocumentUrl],
	);

	const handleViewStoredDocumentSource = React.useCallback(
		(document: MerchantKybDocumentRecord): void => {
			void fetchStoredDocumentUrl(document, "inline")
				.then((viewUrl): void => {
					if (viewUrl === null) {
						setError("This document is still scanning or was rejected.");
						return;
					}
					openExternalDocument(viewUrl);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[fetchStoredDocumentUrl],
	);

	const handleBusinessContinue = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = MerchantKybBusinessFieldsSchema.safeParse({
				businessName: values.businessName,
				legalName: values.legalName,
				addressText: values.addressText,
				contactPhone: values.contactPhone,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details and try again.");
				return;
			}

			setStep("registration");
		},
		[values],
	);

	const handleRegistrationContinue = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = MerchantKybRegistrationFieldsSchema.safeParse({
				registrationNo: values.registrationNo,
				taxId: values.taxId,
				documentType: values.documentType,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your registration details and try again.");
				return;
			}

			setStep("documents");
		},
		[values],
	);

	const handleDocumentsSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setSuccessMessage(null);

			if (values.documents.length === 0) {
				setError("Upload at least one business registration document.");
				return;
			}
			if (values.documents.length > MERCHANT_KYB_MAX_DOCUMENT_COUNT) {
				setError(`You can upload up to ${String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents.`);
				return;
			}

			const parsed = MerchantKybSubmissionFormSchema.safeParse({
				businessName: values.businessName,
				legalName: values.legalName,
				addressText: values.addressText,
				contactPhone: values.contactPhone,
				registrationNo: values.registrationNo,
				taxId: values.taxId,
				documentType: values.documentType,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details and try again.");
				return;
			}

			setIsSubmitting(true);
			void submitMerchantKyb(api, parsed.data, values.documents, profile.merchantOrgId)
				.then((response): void => {
					setValues(profileToFieldValues(response));
					setStep("business");
					setSuccessMessage(
						profile.kybStatus === "PENDING" || profile.kybStatus === "ACTION_REQUIRED"
							? "Your submission has been updated. Documents are being scanned before review."
							: "Business verification updated. Our team will review your details.",
					);
					void queryClient.invalidateQueries({ queryKey: MERCHANT_ME_QUERY_KEY });
					void queryClient.invalidateQueries({ queryKey: ["merchant", "kyb"] });
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsSubmitting(false);
				});
		},
		[api, profile.kybStatus, profile.merchantOrgId, queryClient, values],
	);

	const handleBack = React.useCallback((): void => {
		setError(null);
		if (step === "registration") {
			setStep("business");
			return;
		}
		if (step === "documents") {
			setStep("registration");
		}
	}, [step]);

	const rejectionReasonValue = readKybStringField(profile, "rejectionReason");
	const rejectionReason = rejectionReasonValue.length > 0 ? rejectionReasonValue : null;

	return (
		<div className="space-y-6">
			<Badge variant={kybStatusVariant(profile.kybStatus)}>{profile.kybStatus}</Badge>

			{profile.kybStatus === "ACTION_REQUIRED" ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					A security scan flagged one or more documents. Please upload a clean set of files and resubmit.
				</div>
			) : null}

			{profile.kybStatus === "REJECTED" && rejectionReason !== null ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{rejectionReason}</div>
			) : null}

			{successMessage !== null ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{successMessage}</div> : null}

			{isApproved ? (
				<div className="space-y-8">
					<p className="text-sm text-muted-foreground">
						Your business verification is approved. The details below are read-only — contact support if any registered details need to change.
					</p>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">Business details</h2>
						<MerchantKybBusinessFields values={values} idPrefix="merchant-verification" readOnly />
					</section>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">Registration details</h2>
						<MerchantKybRegistrationFields values={values} idPrefix="merchant-verification" readOnly />
					</section>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">Business registration documents</h2>
						<MerchantKybStoredDocumentList
							documents={storedDocuments}
							onView={handleViewStoredDocument}
							onDownload={handleDownloadStoredDocument}
							onViewSource={handleViewStoredDocumentSource}
						/>
					</section>
				</div>
			) : null}

			{canUpdate ? (
				<div className="space-y-6">
					<p className="text-sm text-muted-foreground">
						{profile.kybStatus === "REJECTED" || profile.kybStatus === "ACTION_REQUIRED"
							? "Update your business details and documents, then resubmit for review."
							: hasSubmitted
								? "Your submission is under review. Review what you submitted below and update anything that needs correcting before an admin approves it."
								: "Complete your business verification by submitting the details and documents below."}
					</p>

					{storedDocuments.length > 0 ? (
						<section className="space-y-3">
							<h2 className="text-sm font-semibold">Documents on file</h2>
							<MerchantKybStoredDocumentList
								documents={storedDocuments}
								onView={handleViewStoredDocument}
								onDownload={handleDownloadStoredDocument}
								onViewSource={handleViewStoredDocumentSource}
							/>
						</section>
					) : null}

					<MerchantOnboardingStepper steps={UPDATE_STEPS} currentStepId={step} completedStepIds={completedStepIds} />

					{step === "business" ? (
						<FormShell error={error} isLoading={false} submitLabel="Continue" loadingLabel="Continue" submitClassName="h-11" onSubmit={handleBusinessContinue}>
							<MerchantKybBusinessFields values={values} onChange={handleBusinessFieldChange} idPrefix="merchant-verification" />
						</FormShell>
					) : null}

					{step === "registration" ? (
						<FormShell
							error={error}
							isLoading={false}
							submitLabel="Continue"
							loadingLabel="Continue"
							submitClassName="h-11"
							onSubmit={handleRegistrationContinue}
							secondaryAction={
								<Button type="button" variant="outline" className="h-11" onClick={handleBack}>
									Back
								</Button>
							}>
							<MerchantKybRegistrationFields values={values} onChange={handleRegistrationFieldChange} idPrefix="merchant-verification" />
						</FormShell>
					) : null}

					{step === "documents" ? (
						<FormShell
							error={error}
							isLoading={isSubmitting}
							submitLabel="Submit for review"
							loadingLabel="Submitting…"
							submitClassName="h-11"
							onSubmit={handleDocumentsSubmit}
							secondaryAction={
								<Button type="button" variant="outline" className="h-11" onClick={handleBack}>
									Back
								</Button>
							}>
							<MerchantKybDocumentUpload documents={values.documents} onChange={handleDocumentsChange} idPrefix="merchant-verification-documents" />
						</FormShell>
					) : null}
				</div>
			) : null}
			<MerchantKybDocumentPreviewDialog preview={documentPreview} onClose={handleCloseDocumentPreview} />
		</div>
	);
}
