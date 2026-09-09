"use client";

import type { MerchantKybDocument, MerchantKybProfileResponse } from "@workspace/shared";
import { JsonPrimitiveSchema, MerchantKybSubmissionSchema } from "@workspace/shared";
import { z } from "zod";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { MERCHANT_ME_QUERY_KEY } from "./invalidate-session-auth";
import { hasSubmittedMerchantKyb, readStoredKybDocuments } from "./merchant-kyb-document-utils";
import { MerchantKybDocumentUpload } from "./merchant-kyb-document-upload";
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
		legalName: readOrgString(profile.legalName),
		addressText: readOrgString(profile.addressText),
		contactPhone: readOrgString(profile.contactPhone),
		registrationNo: readKybStringField(profile, "registrationNo"),
		taxId: readKybStringField(profile, "taxId"),
		documentType: readKybStringField(profile, "documentType"),
		documents: readStoredKybDocuments(profile.kybFields).map((document): MerchantKybDocument => ({
			fileName: document.fileName,
			mimeType: document.mimeType,
			sizeBytes: document.sizeBytes,
			contentBase64: document.contentBase64,
		})),
	};
}

function kybStatusVariant(status: MerchantKybProfileResponse["kybStatus"]): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED") {
		return "destructive";
	}
	return "outline";
}

export function MerchantKybVerificationView(): React.JSX.Element {
	const { api } = useAuth();
	const profileQuery = api.merchant.kyb.get.useQuery({}, { staleTime: 0 });
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
	const submitMutation = api.merchant.kyb.submit.useMutation();

	const hasSubmitted = hasSubmittedMerchantKyb(profile);
	const isApproved = profile.kybStatus === "APPROVED";
	const canUpdate = !isApproved;

	const [step, setStep] = React.useState<UpdateStep>("business");
	const [values, setValues] = React.useState<MerchantKybFieldValues>(() => profileToFieldValues(profile));
	const [error, setError] = React.useState<string | null>(null);
	const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

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

	const handleBusinessFieldChange = React.useCallback((field: "legalName" | "addressText" | "contactPhone", value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleRegistrationFieldChange = React.useCallback((field: "registrationNo" | "taxId" | "documentType", value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleDocumentsChange = React.useCallback((documents: MerchantKybFieldValues["documents"]): void => {
		setValues((current) => ({ ...current, documents }));
	}, []);

	const handleBusinessContinue = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = MerchantKybSubmissionSchema.pick({ legalName: true, addressText: true, contactPhone: true }).safeParse({
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

			const parsed = MerchantKybSubmissionSchema.pick({ registrationNo: true, taxId: true, documentType: true }).safeParse({
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

			const parsed = MerchantKybSubmissionSchema.safeParse(values);
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details and try again.");
				return;
			}

			void submitMutation
				.mutateAsync(parsed.data)
				.then((response): void => {
					setValues(profileToFieldValues(response.data));
					setStep("business");
					setSuccessMessage(
						profile.kybStatus === "PENDING"
							? "Your submission has been updated. Our team will review the latest details."
							: "Business verification updated. Our team will review your details.",
					);
					void queryClient.invalidateQueries({ queryKey: MERCHANT_ME_QUERY_KEY });
					void queryClient.invalidateQueries({ queryKey: ["merchant", "kyb"] });
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[profile.kybStatus, queryClient, submitMutation, values],
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
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={kybStatusVariant(profile.kybStatus)}>{profile.kybStatus}</Badge>
				<span className="text-sm text-muted-foreground">{profile.businessName}</span>
			</div>

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
						<MerchantKybDocumentUpload documents={values.documents} idPrefix="merchant-verification-documents" readOnly />
					</section>
				</div>
			) : null}

			{canUpdate ? (
				<div className="space-y-6">
					<p className="text-sm text-muted-foreground">
						{profile.kybStatus === "REJECTED"
							? "Update your business details and documents, then resubmit for review."
							: hasSubmitted
								? "Your submission is under review. Review what you submitted during onboarding below and update anything that needs correcting before an admin approves it."
								: "Complete your business verification by submitting the details and documents below."}
					</p>
					<MerchantOnboardingStepper steps={UPDATE_STEPS} currentStepId={step} completedStepIds={completedStepIds} />

					{step === "business" ? (
						<FormShell error={error} isLoading={false} submitLabel="Continue" loadingLabel="Continue" submitClassName="h-11" onSubmit={handleBusinessContinue}>
							<MerchantKybBusinessFields values={values} onChange={handleBusinessFieldChange} idPrefix="merchant-verification" />
						</FormShell>
					) : null}

					{step === "registration" ? (
						<FormShell error={error} isLoading={false} submitLabel="Continue" loadingLabel="Continue" submitClassName="h-11" onSubmit={handleRegistrationContinue}>
							<MerchantKybRegistrationFields values={values} onChange={handleRegistrationFieldChange} idPrefix="merchant-verification" />
							<Button type="button" variant="outline" className="h-11 w-full" onClick={handleBack}>
								Back
							</Button>
						</FormShell>
					) : null}

					{step === "documents" ? (
						<FormShell
							error={error}
							isLoading={submitMutation.isPending}
							submitLabel={profile.kybStatus === "REJECTED" ? "Resubmit for review" : hasSubmitted ? "Update submission" : "Submit for review"}
							loadingLabel="Submitting…"
							submitClassName="h-11"
							onSubmit={handleDocumentsSubmit}>
							<MerchantKybDocumentUpload
								documents={values.documents}
								onChange={handleDocumentsChange}
								idPrefix="merchant-verification-documents"
								helperText="Review your uploaded documents or replace them before saving. PDF, JPEG, PNG, or WebP up to 5 MB each."
							/>
							<Button type="button" variant="outline" className="h-11 w-full" onClick={handleBack}>
								Back
							</Button>
						</FormShell>
					) : null}
				</div>
			) : null}
		</div>
	);
}
