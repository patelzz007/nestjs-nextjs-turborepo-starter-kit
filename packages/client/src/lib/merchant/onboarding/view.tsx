"use client";

import type { MerchantBusinessCategory, MerchantOnboardingInvitePreview } from "@workspace/shared";
import {
	MERCHANT_KYB_MAX_DOCUMENT_COUNT,
	MerchantKybBusinessFieldsSchema,
	MerchantKybRegistrationFieldsSchema,
	MerchantOnboardingCompleteFieldsSchema,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type JSX, type SyntheticEvent } from "react";

import { API_BASE_URL } from "../../api/config";
import { resolveAuthErrorMessage } from "../../auth/errors";
import { useAuth } from "../../auth/index";
import { passwordStrength } from "../../auth/password";
import type { MerchantKybFieldValues } from "../kyb/fields";
import { submitMerchantOnboardingComplete, submitMerchantOnboardingDocuments } from "../kyb/multipart";
import { MerchantOnboardingAccountStep } from "./onboarding-account-step";
import { MerchantOnboardingBusinessStep } from "./onboarding-business-step";
import { MerchantOnboardingDocumentsStep } from "./onboarding-documents-step";
import { MerchantOnboardingRegistrationStep } from "./onboarding-registration-step";

type FlowStep = "loading" | "invalid" | "wizard" | "success";
type WizardPanel = "business" | "registration" | "documents" | "account";

interface WizardStepDefinition {
	readonly id: WizardPanel;
	readonly label: string;
	readonly description: string;
}

const WIZARD_STEPS: readonly WizardStepDefinition[] = [
	{ id: "business", label: "Business", description: "Store and contact details" },
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
	return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function panelHeading(panel: WizardPanel): string {
	if (panel === "business") {
		return "Tell us about your business";
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

	const strength = useMemo(() => passwordStrength(password), [password]);
	const wizardIndex = WIZARD_STEPS.findIndex((step) => step.id === wizardPanel);

	const loginUrl = useMemo((): string => {
		if (invite === null) {
			return loginHref;
		}
		const params = new URLSearchParams({ email: invite.email });
		return `${loginHref}?${params.toString()}`;
	}, [invite, loginHref]);

	useEffect((): (() => void) => {
		let cancelled = false;
		void api.merchant.onboarding.validate
			.mutate({ token })
			.then((response): void => {
				if (cancelled) {
					return;
				}
				setInvite(response.data);
				setValues((current) => ({ ...current, businessName: response.data.businessName, legalName: response.data.businessName }));
				setFlowStep("wizard");
			})
			.catch((reason: unknown): void => {
				if (!cancelled) {
					setFlowStep("invalid");
					setError(resolveAuthErrorMessage(reason));
				}
			});
		return (): void => {
			cancelled = true;
		};
	}, [api.merchant.onboarding.validate, token]);

	const handleBusinessFieldChange = useCallback((field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string): void => {
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

	const handleBackToRegistration = useCallback((): void => {
		advance("registration");
	}, [advance]);

	const handleBackToDocuments = useCallback((): void => {
		advance("documents");
	}, [advance]);

	const handleBusinessContinue = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = MerchantKybBusinessFieldsSchema.safeParse({
				businessName: values.businessName,
				legalName: values.legalName,
				addressText: values.addressText,
				contactPhone: values.contactPhone,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details.");
				return;
			}
			advance("registration");
		},
		[advance, values],
	);

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
				addressText: values.addressText,
				contactPhone: values.contactPhone,
				registrationNo: values.registrationNo,
				taxId: values.taxId,
				documentType: values.documentType,
			});
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
				return;
			}

			setIsSubmitting(true);
			void submitMerchantOnboardingComplete(API_BASE_URL, parsed.data)
				.then(async (response): Promise<void> => {
					await submitMerchantOnboardingDocuments(api, token, values.documents);
					setBusinessName(response.businessName);
					setFlowStep("success");
				})
				.catch((reason: unknown): void => {
					setError(resolveAuthErrorMessage(reason));
				})
				.finally((): void => {
					setIsSubmitting(false);
				});
		},
		[api, category, fullName, password, token, values],
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
				<Button variant="outline" nativeButton={false} className="w-full sm:w-auto" render={<Link href={loginHref} />}>
					Back to sign in
				</Button>
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
				<Button nativeButton={false} className="h-11 w-full sm:w-auto" render={<Link href={loginUrl} />}>
					Continue to sign in
				</Button>
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

				{wizardPanel === "registration" ? (
					<MerchantOnboardingRegistrationStep
						values={values}
						onRegistrationFieldChange={handleRegistrationFieldChange}
						onBack={handleBackToBusiness}
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
