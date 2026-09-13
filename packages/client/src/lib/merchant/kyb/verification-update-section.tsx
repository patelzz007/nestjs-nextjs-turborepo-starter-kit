"use client";

import type { MerchantKybDocumentRecord, MerchantKybProfileResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import type { JSX, SyntheticEvent } from "react";

import { MerchantOnboardingStepper, type MerchantOnboardingStep } from "../onboarding/stepper";
import { MerchantKybDocumentUpload } from "./document-upload";
import { MerchantKybBusinessFields, MerchantKybRegistrationFields, type MerchantKybFieldValues } from "./fields";
import { MerchantKybStoredDocumentList } from "./stored-document-list";

export type MerchantKybVerificationUpdateStep = "business" | "registration" | "documents";

export const MERCHANT_KYB_UPDATE_STEPS: readonly MerchantOnboardingStep[] = [
	{ id: "business", label: "Business", description: "Registered details" },
	{ id: "registration", label: "Registration", description: "SSM & tax ID" },
	{ id: "documents", label: "Documents", description: "Upload certificates" },
];

export interface MerchantKybVerificationUpdateSectionProps {
	readonly profile: MerchantKybProfileResponse;
	readonly hasSubmitted: boolean;
	readonly storedDocuments: readonly MerchantKybDocumentRecord[];
	readonly step: MerchantKybVerificationUpdateStep;
	readonly completedStepIds: ReadonlySet<string>;
	readonly values: MerchantKybFieldValues;
	readonly error: string | null;
	readonly isSubmitting: boolean;
	readonly onBusinessFieldChange: (field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string) => void;
	readonly onRegistrationFieldChange: (field: "registrationNo" | "taxId" | "documentType", value: string) => void;
	readonly onDocumentsChange: (documents: MerchantKybFieldValues["documents"]) => void;
	readonly onViewStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onDownloadStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onViewStoredDocumentSource: (document: MerchantKybDocumentRecord) => void;
	readonly onBusinessContinue: (event: SyntheticEvent<HTMLFormElement>) => void;
	readonly onRegistrationContinue: (event: SyntheticEvent<HTMLFormElement>) => void;
	readonly onDocumentsSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	readonly onBack: () => void;
}

export function MerchantKybVerificationUpdateSection({
	profile,
	hasSubmitted,
	storedDocuments,
	step,
	completedStepIds,
	values,
	error,
	isSubmitting,
	onBusinessFieldChange,
	onRegistrationFieldChange,
	onDocumentsChange,
	onViewStoredDocument,
	onDownloadStoredDocument,
	onViewStoredDocumentSource,
	onBusinessContinue,
	onRegistrationContinue,
	onDocumentsSubmit,
	onBack,
}: MerchantKybVerificationUpdateSectionProps): JSX.Element {
	return (
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
						onView={onViewStoredDocument}
						onDownload={onDownloadStoredDocument}
						onViewSource={onViewStoredDocumentSource}
					/>
				</section>
			) : null}

			<MerchantOnboardingStepper steps={MERCHANT_KYB_UPDATE_STEPS} currentStepId={step} completedStepIds={completedStepIds} />

			{step === "business" ? (
				<FormShell error={error} isLoading={false} submitLabel="Continue" loadingLabel="Continue" submitClassName="h-11" onSubmit={onBusinessContinue}>
					<MerchantKybBusinessFields values={values} onChange={onBusinessFieldChange} idPrefix="merchant-verification" />
				</FormShell>
			) : null}

			{step === "registration" ? (
				<FormShell
					error={error}
					isLoading={false}
					submitLabel="Continue"
					loadingLabel="Continue"
					submitClassName="h-11"
					onSubmit={onRegistrationContinue}
					secondaryAction={
						<Button type="button" variant="outline" className="h-11" onClick={onBack}>
							Back
						</Button>
					}>
					<MerchantKybRegistrationFields values={values} onChange={onRegistrationFieldChange} idPrefix="merchant-verification" />
				</FormShell>
			) : null}

			{step === "documents" ? (
				<FormShell
					error={error}
					isLoading={isSubmitting}
					submitLabel="Submit for review"
					loadingLabel="Submitting…"
					submitClassName="h-11"
					onSubmit={onDocumentsSubmit}
					secondaryAction={
						<Button type="button" variant="outline" className="h-11" onClick={onBack}>
							Back
						</Button>
					}>
					<MerchantKybDocumentUpload documents={values.documents} onChange={onDocumentsChange} idPrefix="merchant-verification-documents" />
				</FormShell>
			) : null}
		</div>
	);
}
