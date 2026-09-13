"use client";

import type { FileDownloadDisposition, MerchantKybDocumentRecord, MerchantKybProfileResponse } from "@workspace/shared";
import { MERCHANT_KYB_MAX_DOCUMENT_COUNT, MerchantKybBusinessFieldsSchema, MerchantKybRegistrationFieldsSchema, MerchantKybSubmissionFormSchema } from "@workspace/shared";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { resolveAuthErrorMessage } from "../../auth/errors";
import { useAuth } from "../../auth/index";
import { MERCHANT_ME_QUERY_KEY } from "../../auth/session/invalidate-auth";
import { hasSubmittedMerchantKyb, openExternalDocument, readProfileKybDocuments, triggerBrowserDownload } from "./document-utils";
import { MerchantKybDocumentPreviewDialog, type MerchantKybDocumentPreviewState } from "./document-preview-dialog";
import { submitMerchantKyb } from "./multipart";
import type { MerchantKybFieldValues } from "./fields";
import { MerchantKybVerificationApprovedSection } from "./verification-approved-section";
import { profileToFieldValues, readKybStringField } from "./verification-profile-utils";
import { MerchantKybVerificationStatusBanners } from "./verification-status-banners";
import { MerchantKybVerificationUpdateSection, type MerchantKybVerificationUpdateStep } from "./verification-update-section";

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

	const [step, setStep] = React.useState<MerchantKybVerificationUpdateStep>("business");
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
			<MerchantKybVerificationStatusBanners profile={profile} rejectionReason={rejectionReason} successMessage={successMessage} />

			{isApproved ? (
				<MerchantKybVerificationApprovedSection
					values={values}
					storedDocuments={storedDocuments}
					onViewStoredDocument={handleViewStoredDocument}
					onDownloadStoredDocument={handleDownloadStoredDocument}
					onViewStoredDocumentSource={handleViewStoredDocumentSource}
				/>
			) : null}

			{canUpdate ? (
				<MerchantKybVerificationUpdateSection
					profile={profile}
					hasSubmitted={hasSubmitted}
					storedDocuments={storedDocuments}
					step={step}
					completedStepIds={completedStepIds}
					values={values}
					error={error}
					isSubmitting={isSubmitting}
					onBusinessFieldChange={handleBusinessFieldChange}
					onRegistrationFieldChange={handleRegistrationFieldChange}
					onDocumentsChange={handleDocumentsChange}
					onViewStoredDocument={handleViewStoredDocument}
					onDownloadStoredDocument={handleDownloadStoredDocument}
					onViewStoredDocumentSource={handleViewStoredDocumentSource}
					onBusinessContinue={handleBusinessContinue}
					onRegistrationContinue={handleRegistrationContinue}
					onDocumentsSubmit={handleDocumentsSubmit}
					onBack={handleBack}
				/>
			) : null}
			<MerchantKybDocumentPreviewDialog preview={documentPreview} onClose={handleCloseDocumentPreview} />
		</div>
	);
}
