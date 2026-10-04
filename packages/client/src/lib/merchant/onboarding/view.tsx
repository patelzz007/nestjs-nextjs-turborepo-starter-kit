"use client";

import type { MerchantBusinessCategory, MerchantOnboardingInvitePreview, OrganizationPrimaryLocationDraft } from "@workspace/shared";
import {
	MERCHANT_KYB_MAX_DOCUMENT_COUNT,
	MerchantKybRegistrationFieldsSchema,
	MerchantOnboardingBusinessFieldsSchema,
	MerchantOnboardingCompleteFieldsSchema,
	OrganizationLocationDraftSchema,
	OrganizationPrimaryLocationDraftSchema,
	PLATFORM_DISPLAY_REGION,
} from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type JSX, type SyntheticEvent } from "react";

import { useAuth } from "../../auth/index";
import { passwordStrength } from "../../auth/password";
import type { MerchantKybFieldValues } from "../kyb/fields";
import { submitMerchantOnboardingDocuments } from "../kyb/multipart";
import { MerchantOnboardingAccountStep } from "./onboarding-account-step";
import { MerchantOnboardingBusinessStep, type BusinessFieldName } from "./onboarding-business-step";
import { MerchantOnboardingDocumentsStep } from "./onboarding-documents-step";
import { MerchantOnboardingRegistrationStep } from "./onboarding-registration-step";
import { MerchantOnboardingStoresStep, type OnboardingLocationDraftRow } from "./onboarding-stores-step";
import { catchCaught } from "../../caught";
import { classifyOnboardingFailure, type OnboardingFailure } from "./onboarding-outcome";
import { runOnboardingSubmission } from "./onboarding-submission";

type FlowStep = "loading" | "invalid" | "expired" | "documents-closed" | "wizard" | "success";
type WizardPanel = "business" | "stores" | "registration" | "documents" | "account";

interface WizardStepDefinition {
	readonly id: WizardPanel;
	readonly label: string;
	readonly description: string;
}

const WIZARD_STEPS: readonly WizardStepDefinition[] = [
	{ id: "business", label: "Business", description: "Legal name and category" },
	{ id: "stores", label: "Stores", description: "Primary store and optional locations" },
	{ id: "registration", label: "Registration", description: "SSM and tax information" },
	{ id: "documents", label: "Documents", description: "Proof for admin review" },
	{ id: "account", label: "Owner account", description: "Secure your login" },
];

const INITIAL_KYB_VALUES: MerchantKybFieldValues = {
	businessName: "",
	legalName: "",
	addressText: "",
	contactPhone: "",
	registrationNo: "",
	taxId: "",
	documentType: "",
	documents: [],
};

function formatPilotCity(city: string): string {
	return city.replaceAll("_", " ");
}

function formatExpiry(value: number): string {
	return formatEpochMs(value, "date", PLATFORM_DISPLAY_REGION);
}

function panelHeading(panel: WizardPanel): string {
	if (panel === "business") {
		return "Tell us about your business";
	}
	if (panel === "stores") {
		return "Add your store locations";
	}
	if (panel === "registration") {
		return "Add registration details";
	}
	if (panel === "documents") {
		return "Upload supporting documents";
	}
	return "Create your owner login";
}

export interface MerchantOnboardingViewProps {
	readonly token: string;
	readonly loginHref?: string;
}

/** The page a failure leads to; `undefined` = stay on the step (the message is shown there). */
function flowStepForFailure(failure: OnboardingFailure): FlowStep | undefined {
	switch (failure.kind) {
		case "expired":
			return "expired";
		case "invalid":
			return "invalid";
		case "documents-closed":
			return "documents-closed";
		case "already-submitted":
		case "retry":
			return undefined;
	}
}

function failureMessage(failure: OnboardingFailure): string | null {
	return failure.kind === "retry" ? failure.message : null;
}

export function MerchantOnboardingView({ token, loginHref = "/auth/login" }: MerchantOnboardingViewProps): JSX.Element {
	const { api } = useAuth();
	const [flowStep, setFlowStep] = useState<FlowStep>("loading");
	const [wizardPanel, setWizardPanel] = useState<WizardPanel>("business");
	const [error, setError] = useState<string | null>(null);
	const [invite, setInvite] = useState<MerchantOnboardingInvitePreview | null>(null);
	const [fullName, setFullName] = useState("");
	const [password, setPassword] = useState("");
	const [category, setCategory] = useState<MerchantBusinessCategory>("cafe");
	const [values, setValues] = useState<MerchantKybFieldValues>(INITIAL_KYB_VALUES);
	const [businessName, setBusinessName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	// `complete` succeeded in an earlier attempt: a retry only re-sends the documents (complete runs once).
	const [isApplicationSubmitted, setIsApplicationSubmitted] = useState(false);
	const [primaryLocation, setPrimaryLocation] = useState<OrganizationPrimaryLocationDraft>({ name: "", addressText: "", contactPhone: "" });
	const [additionalLocations, setAdditionalLocations] = useState<readonly OnboardingLocationDraftRow[]>([]);

	const strength = useMemo(() => passwordStrength(password), [password]);
	const wizardIndex = WIZARD_STEPS.findIndex((step) => step.id === wizardPanel);

	// The sign-in link never carries the email: a query string ends up in
	// history, logs and Referer headers, and the address is personal data.
	const loginUrl: string = loginHref;

	useEffect((): (() => void) => {
		let cancelled = false;
		void catchCaught(
			api.organizations.onboarding.validate.mutate({ token }).then((response): void => {
				if (cancelled) {
					return;
				}
				setInvite(response.data);
				setValues((current) => ({ ...current, businessName: response.data.businessName, legalName: response.data.businessName }));
				setPrimaryLocation((current) => ({ ...current, name: response.data.businessName }));
				setFlowStep("wizard");
			}),
			(reason): void => {
				if (!cancelled) {
					const failure = classifyOnboardingFailure(reason);
					setFlowStep(failure.kind === "expired" ? "expired" : "invalid");
					setError(failureMessage(failure));
				}
			},
		);
		return (): void => {
			cancelled = true;
		};
	}, [api.organizations.onboarding.validate, token]);

	const handleBusinessFieldChange = useCallback((field: BusinessFieldName, value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleRegistrationFieldChange = useCallback((field: "registrationNo" | "taxId" | "documentType", value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleDocumentsChange = useCallback((documents: MerchantKybFieldValues["documents"]): void => {
		setValues((current) => ({ ...current, documents }));
	}, []);

	const handleFullNameChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setFullName(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const handleCategoryChange = useCallback((value: MerchantBusinessCategory): void => {
		setCategory(value);
	}, []);

	const advance = useCallback((panel: WizardPanel): void => {
		setError(null);
		setWizardPanel(panel);
	}, []);

	const handleBackToBusiness = useCallback((): void => {
		advance("business");
	}, [advance]);

	const handleBackToStores = useCallback((): void => {
		advance("stores");
	}, [advance]);

	const handleBackToRegistration = useCallback((): void => {
		advance("registration");
	}, [advance]);

	const handleBackToDocuments = useCallback((): void => {
		advance("documents");
	}, [advance]);

	const handleBusinessContinue = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = MerchantOnboardingBusinessFieldsSchema.safeParse({
				legalName: values.legalName,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details.");
				return;
			}
			advance("stores");
		},
		[advance, values],
	);

	const handleStoresContinue = useCallback((): void => {
		setError(null);
		const parsedPrimary = OrganizationPrimaryLocationDraftSchema.safeParse({
			name: primaryLocation.name,
			addressText: primaryLocation.addressText,
			contactPhone: primaryLocation.contactPhone,
		});
		if (!parsedPrimary.success) {
			setError(parsedPrimary.error.issues[0]?.message ?? "Check your primary store details.");
			return;
		}
		for (const location of additionalLocations) {
			const parsed = OrganizationLocationDraftSchema.safeParse({
				name: location.draft.name,
				addressText: location.draft.addressText,
				contactPhone: location.draft.contactPhone?.trim().length === 0 ? undefined : location.draft.contactPhone,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your additional store details.");
				return;
			}
		}
		advance("registration");
	}, [additionalLocations, advance, primaryLocation]);

	const handleRegistrationContinue = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = MerchantKybRegistrationFieldsSchema.safeParse({
				registrationNo: values.registrationNo,
				taxId: values.taxId,
				documentType: values.documentType,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your registration details.");
				return;
			}
			advance("documents");
		},
		[advance, values],
	);

	const handleDocumentsContinue = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (values.documents.length === 0) {
				setError("Upload at least one business registration document.");
				return;
			}
			if (values.documents.length > MERCHANT_KYB_MAX_DOCUMENT_COUNT) {
				setError(`You can upload up to ${String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents.`);
				return;
			}
			advance("account");
		},
		[advance, values.documents.length],
	);

	const handleAccountSubmit = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			const parsed = MerchantOnboardingCompleteFieldsSchema.safeParse({
				token,
				fullName,
				password,
				category,
				legalName: values.legalName,
				primaryLocation,
				registrationNo: values.registrationNo,
				taxId: values.taxId,
				documentType: values.documentType,
				additionalLocations: additionalLocations.map((row) => row.draft),
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
				return;
			}

			setIsSubmitting(true);
			void runOnboardingSubmission(
				{
					completeApplication: async (): Promise<string> => (await api.organizations.onboarding.complete.mutate(parsed.data)).data.businessName,
					submitDocuments: (): Promise<void> => submitMerchantOnboardingDocuments(api, token, values.documents),
				},
				isApplicationSubmitted,
			)
				.then((result): void => {
					if (result.kind === "submitted") {
						setBusinessName(result.businessName ?? invite?.businessName ?? "");
						setFlowStep("success");
						return;
					}
					setIsApplicationSubmitted(result.isApplicationSubmitted);
					const nextStep = flowStepForFailure(result.failure);
					if (nextStep !== undefined) {
						setFlowStep(nextStep);
						return;
					}
					setError(failureMessage(result.failure));
				})
				.finally((): void => {
					setIsSubmitting(false);
				});
		},
		[additionalLocations, api, category, fullName, invite?.businessName, isApplicationSubmitted, password, primaryLocation, token, values],
	);

	if (flowStep === "loading") {
		return (
			<div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
				<div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
				<p className="text-sm text-muted-foreground">Verifying your invite…</p>
			</div>
		);
	}

	if (flowStep === "invalid") {
		return (
			<div className="space-y-6 text-center">
				<h2 className="text-xl font-semibold tracking-tight">Invite unavailable</h2>
				<p className="text-sm text-muted-foreground">{error ?? "This invite link is invalid or has expired."}</p>
				<Link href={loginHref} className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
					Back to sign in
				</Link>
			</div>
		);
	}

	if (flowStep === "expired") {
		return (
			<div className="space-y-6 text-center">
				<h2 className="text-xl font-semibold tracking-tight">This invite has expired</h2>
				<p className="text-sm text-muted-foreground">Merchant invites are valid for a limited time. Ask the Reward Hub team to send you a new invite link.</p>
				<Link href={loginHref} className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
					Back to sign in
				</Link>
			</div>
		);
	}

	if (flowStep === "documents-closed") {
		return (
			<div className="space-y-6 text-center">
				<h2 className="text-xl font-semibold tracking-tight">Upload your documents from your account</h2>
				<p className="text-sm text-muted-foreground">
					Your application was received, but this link can no longer take documents. Sign in and add them under Settings › Verification.
				</p>
				<Link href={loginHref} className={cn(buttonVariants(), "h-11 w-full sm:w-auto")}>
					Sign in
				</Link>
			</div>
		);
	}

	if (flowStep === "success") {
		return (
			<div className="space-y-6 text-center">
				<div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden="true">
					<svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<div className="space-y-2">
					<h2 className="text-2xl font-semibold tracking-tight">Submitted for review</h2>
					<p className="text-sm leading-relaxed text-muted-foreground">
						<span className="font-medium text-foreground">{businessName}</span> and its verification documents were submitted. You can sign in while an admin reviews your
						application.
					</p>
				</div>
				<Link href={loginUrl} className={cn(buttonVariants(), "h-11 w-full sm:w-auto")}>
					Continue to sign in
				</Link>
			</div>
		);
	}

	if (invite === null) {
		return <p className="text-center text-sm text-muted-foreground">Loading invite details…</p>;
	}

	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
			<aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
				<div className="space-y-1">
					<p className="text-xs font-medium tracking-wide text-primary uppercase">Merchant application</p>
					<h2 className="text-2xl font-semibold tracking-tight">{invite.businessName}</h2>
					<p className="text-sm text-muted-foreground">Complete one application for account setup and admin approval.</p>
				</div>
				<dl className="space-y-3 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-xs">
					<div>
						<dt className="text-xs font-medium text-muted-foreground">Work email</dt>
						<dd className="mt-0.5 text-sm font-medium">{invite.email}</dd>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<dt className="text-xs font-medium text-muted-foreground">Pilot city</dt>
							<dd className="mt-0.5 text-sm font-medium">{formatPilotCity(invite.city)}</dd>
						</div>
						<div>
							<dt className="text-xs font-medium text-muted-foreground">Invite expires</dt>
							<dd className="mt-0.5 text-sm font-medium">{formatExpiry(invite.expiresAt)}</dd>
						</div>
					</div>
				</dl>
				<ol className="space-y-3" aria-label="Application progress">
					{WIZARD_STEPS.map((step, index) => {
						const isActive = step.id === wizardPanel;
						const isComplete = index < wizardIndex;
						return (
							<li key={step.id} className="flex items-start gap-3">
								<span
									className={cn(
										"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
										isComplete ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-muted text-muted-foreground",
									)}>
									{isComplete ? "✓" : index + 1}
								</span>
								<div>
									<p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
									<p className="text-xs text-muted-foreground">{step.description}</p>
								</div>
							</li>
						);
					})}
				</ol>
			</aside>

			<section className="relative z-20 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
				<div className="mb-6 flex items-center justify-between gap-3">
					<div>
						<p className="text-xs font-medium text-muted-foreground">
							Step {wizardIndex + 1} of {WIZARD_STEPS.length}
						</p>
						<h3 className="text-lg font-semibold tracking-tight">{panelHeading(wizardPanel)}</h3>
					</div>
					<div className="flex gap-1" aria-hidden="true">
						{WIZARD_STEPS.map((step, index) => (
							<span key={step.id} className={cn("h-1.5 w-5 rounded-full", index <= wizardIndex ? "bg-primary" : "bg-muted")} />
						))}
					</div>
				</div>

				{error !== null ? (
					<div role="alert" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						{error}
					</div>
				) : null}

				{wizardPanel === "business" ? (
					<MerchantOnboardingBusinessStep
						category={category}
						values={values}
						onCategoryChange={handleCategoryChange}
						onBusinessFieldChange={handleBusinessFieldChange}
						onSubmit={handleBusinessContinue}
					/>
				) : null}

				{wizardPanel === "stores" ? (
					<MerchantOnboardingStoresStep
						primaryLocation={primaryLocation}
						onPrimaryLocationChange={setPrimaryLocation}
						additionalLocations={additionalLocations}
						onAdditionalLocationsChange={setAdditionalLocations}
						onBack={handleBackToBusiness}
						onContinue={handleStoresContinue}
						error={error}
					/>
				) : null}

				{wizardPanel === "registration" ? (
					<MerchantOnboardingRegistrationStep
						values={values}
						onRegistrationFieldChange={handleRegistrationFieldChange}
						onBack={handleBackToStores}
						onSubmit={handleRegistrationContinue}
					/>
				) : null}

				{wizardPanel === "documents" ? (
					<MerchantOnboardingDocumentsStep
						documents={values.documents}
						onDocumentsChange={handleDocumentsChange}
						onBack={handleBackToRegistration}
						onSubmit={handleDocumentsContinue}
					/>
				) : null}

				{wizardPanel === "account" ? (
					<MerchantOnboardingAccountStep
						invite={invite}
						fullName={fullName}
						password={password}
						documentCount={values.documents.length}
						strength={strength}
						isSubmitting={isSubmitting}
						onFullNameChange={handleFullNameChange}
						onPasswordChange={handlePasswordChange}
						onBack={handleBackToDocuments}
						onSubmit={handleAccountSubmit}
					/>
				) : null}

				<p className="mt-6 text-center text-xs text-muted-foreground sm:text-left">
					Already have an account?{" "}
					<Link href={loginUrl} className="font-medium text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</section>
		</div>
	);
}
