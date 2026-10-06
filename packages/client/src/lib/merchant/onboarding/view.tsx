"use client";

import type { MerchantBusinessCategory, MerchantOnboardingInvitePreview, OrganizationPrimaryLocationDraft } from "@workspace/shared";
import {
	MERCHANT_KYB_MAX_DOCUMENT_COUNT,
	MerchantKybRegistrationFieldsSchema,
	MerchantOnboardingBusinessFieldsSchema,
	MerchantOnboardingCompleteFieldsSchema,
	OrganizationLocationDraftSchema,
	OrganizationPrimaryLocationDraftSchema,
	PILOT_CITY_LABELS,
	PLATFORM_DISPLAY_REGION,
} from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { CircleCheck } from "lucide-react";
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
import { MerchantOnboardingInviteSummary, MerchantOnboardingSkeleton, ONBOARDING_PANEL_CLASS_NAME } from "./onboarding-invite-summary";
import { MerchantOnboardingCompactProgress, MerchantOnboardingTimeline } from "./onboarding-timeline";
import { catchCaught } from "../../caught";
import { classifyOnboardingFailure, type OnboardingFailure } from "./onboarding-outcome";
import { runOnboardingSubmission } from "./onboarding-submission";

type FlowStep = "loading" | "invalid" | "expired" | "documents-closed" | "wizard" | "success";
type WizardPanel = "business" | "stores" | "registration" | "documents" | "account";

interface WizardStepDefinition {
	readonly id: WizardPanel;
	readonly label: string;
	readonly description: string;
	/** The panel's heading above the form. */
	readonly heading: string;
}

const WIZARD_STEPS: readonly WizardStepDefinition[] = [
	{ id: "business", label: "Business", description: "Legal name and category", heading: "Tell us about your business" },
	{ id: "stores", label: "Stores", description: "Primary store and optional locations", heading: "Add your store locations" },
	{ id: "registration", label: "Registration", description: "SSM and tax information", heading: "Add registration details" },
	{ id: "documents", label: "Documents", description: "Proof for admin review", heading: "Upload supporting documents" },
	{ id: "account", label: "Owner account", description: "Secure your login", heading: "Create your owner login" },
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

function formatExpiry(value: number): string {
	return formatEpochMs(value, "date", PLATFORM_DISPLAY_REGION);
}

/** The message of a failed parse's first issue, or `fallback` when it has none. */
function firstIssue(error: { readonly issues: readonly { readonly message: string }[] }, fallback: string): string {
	return error.issues[0]?.message ?? fallback;
}

interface OnboardingNoticeProps {
	readonly title: string;
	readonly message: string;
	readonly href: string;
	readonly linkLabel: string;
	/** Primary (filled) link instead of the outline one. */
	readonly isPrimaryLink?: boolean;
}

/** A terminal page of the flow: a heading, a message and one link back to sign-in. */
function OnboardingNotice({ title, message, href, linkLabel, isPrimaryLink = false }: OnboardingNoticeProps): JSX.Element {
	return (
		<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "mx-auto w-full max-w-lg space-y-4 p-6 text-center sm:p-8")}>
			<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
			<p className="text-sm text-muted-foreground">{message}</p>
			<Link href={href} className={isPrimaryLink ? cn(buttonVariants(), "h-11 w-full sm:w-auto") : cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
				{linkLabel}
			</Link>
		</div>
	);
}

/** The wizard's loading placeholder — for the page's own Suspense fallback as well as the view's. */
export function MerchantOnboardingViewSkeleton(): JSX.Element {
	return <MerchantOnboardingSkeleton stepCount={WIZARD_STEPS.length} />;
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

	/** Every step's Back goes to the step before it. */
	const handleBack = useCallback((): void => {
		const previous = WIZARD_STEPS[wizardIndex - 1];
		if (previous !== undefined) {
			advance(previous.id);
		}
	}, [advance, wizardIndex]);

	const handleBusinessContinue = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = MerchantOnboardingBusinessFieldsSchema.safeParse({
				legalName: values.legalName,
			});
			if (!parsed.success) {
				setError(firstIssue(parsed.error, "Check your business details."));
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
			setError(firstIssue(parsedPrimary.error, "Check your primary store details."));
			return;
		}
		for (const location of additionalLocations) {
			const parsed = OrganizationLocationDraftSchema.safeParse({
				name: location.draft.name,
				addressText: location.draft.addressText,
				contactPhone: location.draft.contactPhone?.trim().length === 0 ? undefined : location.draft.contactPhone,
			});
			if (!parsed.success) {
				setError(firstIssue(parsed.error, "Check your additional store details."));
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
				setError(firstIssue(parsed.error, "Check your registration details."));
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
				setError(firstIssue(parsed.error, "Check your details and try again."));
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
		return <MerchantOnboardingViewSkeleton />;
	}

	if (flowStep === "invalid") {
		return <OnboardingNotice title="Invite unavailable" message={error ?? "This invite link is invalid or has expired."} href={loginHref} linkLabel="Back to sign in" />;
	}

	if (flowStep === "expired") {
		return (
			<OnboardingNotice
				title="This invite has expired"
				message="Merchant invites are valid for a limited time. Ask the Reward Hub team to send you a new invite link."
				href={loginHref}
				linkLabel="Back to sign in"
			/>
		);
	}

	if (flowStep === "documents-closed") {
		return (
			<OnboardingNotice
				title="Upload your documents from your account"
				message="Your application was received, but this link can no longer take documents. Sign in and add them under Settings › Verification."
				href={loginHref}
				linkLabel="Sign in"
				isPrimaryLink
			/>
		);
	}

	if (flowStep === "success") {
		return (
			<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "mx-auto w-full max-w-lg space-y-6 p-6 text-center sm:p-8")}>
				<div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden="true">
					<CircleCheck className="size-8" />
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
		return <MerchantOnboardingViewSkeleton />;
	}

	const currentStep = WIZARD_STEPS[wizardIndex];

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
			<aside className="space-y-4 lg:sticky lg:top-8 lg:self-start" aria-label="Application summary">
				<MerchantOnboardingInviteSummary
					businessName={invite.businessName}
					email={invite.email}
					city={PILOT_CITY_LABELS[invite.city]}
					expiresOn={formatExpiry(invite.expiresAt)}
				/>
				<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "hidden p-5 lg:block")}>
					<MerchantOnboardingTimeline steps={WIZARD_STEPS} currentStepId={wizardPanel} onStepSelect={advance} isNavigationDisabled={isSubmitting} />
				</div>
			</aside>

			<section aria-labelledby="merchant-onboarding-step-heading" className={cn(ONBOARDING_PANEL_CLASS_NAME, "relative z-20 bg-card p-5 sm:p-6")}>
				<header className="mb-6 space-y-5 border-b border-border/70 pb-5">
					<div className="lg:hidden">
						<MerchantOnboardingCompactProgress steps={WIZARD_STEPS} currentStepId={wizardPanel} />
					</div>
					<div className="space-y-1">
						<p className="text-xs font-medium text-primary">
							Step {wizardIndex + 1} of {WIZARD_STEPS.length}
							<span className="text-muted-foreground"> · {currentStep?.label}</span>
						</p>
						<h2 id="merchant-onboarding-step-heading" className="text-xl font-semibold tracking-tight">
							{currentStep?.heading}
						</h2>
						<p className="text-sm text-muted-foreground">{currentStep?.description}</p>
					</div>
				</header>

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
						onBack={handleBack}
						onContinue={handleStoresContinue}
						error={error}
					/>
				) : null}

				{wizardPanel === "registration" ? (
					<MerchantOnboardingRegistrationStep
						values={values}
						onRegistrationFieldChange={handleRegistrationFieldChange}
						onBack={handleBack}
						onSubmit={handleRegistrationContinue}
					/>
				) : null}

				{wizardPanel === "documents" ? (
					<MerchantOnboardingDocumentsStep documents={values.documents} onDocumentsChange={handleDocumentsChange} onBack={handleBack} onSubmit={handleDocumentsContinue} />
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
						onBack={handleBack}
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
