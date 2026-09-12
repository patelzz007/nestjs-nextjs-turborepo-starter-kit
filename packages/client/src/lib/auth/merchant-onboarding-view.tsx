"use client";

import type { MerchantOnboardingInvitePreview } from "@workspace/shared";
import { MerchantOnboardingCompleteFieldsSchema } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { API_BASE_URL } from "../api/config";
import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { submitMerchantOnboardingComplete } from "./merchant-kyb-multipart";
import { MerchantOnboardingStepper, type MerchantOnboardingStep } from "./merchant-onboarding-stepper";
import { passwordStrength } from "./password";

type OnboardingStep = "loading" | "invalid" | "account" | "success";

const ONBOARDING_STEPS: readonly MerchantOnboardingStep[] = [{ id: "account", label: "Account", description: "Owner login" }];

function formatPilotCity(city: string): string {
	return city.replaceAll("_", " ");
}

function formatExpiry(value: number): string {
	return new Date(value).toLocaleString();
}

export interface MerchantOnboardingViewProps {
	readonly token: string;
	readonly loginHref?: string;
}

export function MerchantOnboardingView({ token, loginHref = "/auth/login" }: MerchantOnboardingViewProps): JSX.Element {
	const { api } = useAuth();

	const [step, setStep] = useState<OnboardingStep>("loading");
	const [error, setError] = useState<string | null>(null);
	const [invite, setInvite] = useState<MerchantOnboardingInvitePreview | null>(null);
	const [fullName, setFullName] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [businessName, setBusinessName] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const strength = useMemo(() => passwordStrength(password), [password]);

	const loginUrl = useMemo((): string => {
		if (invite === null) {
			return loginHref;
		}
		const params = new URLSearchParams({ email: invite.email });
		return `${loginHref}?${params.toString()}`;
	}, [invite, loginHref]);

	const completedStepIds = useMemo((): ReadonlySet<string> => {
		const completed = new Set<string>();
		if (step === "success") {
			completed.add("account");
		}
		return completed;
	}, [step]);

	useEffect((): (() => void) => {
		if (token.length === 0) {
			return (): void => undefined;
		}

		let cancelled = false;

		void api.merchant.onboarding.validate
			.mutate({ token })
			.then((response): void => {
				if (!cancelled) {
					setInvite(response.data);
					setStep("account");
				}
			})
			.catch((err: unknown): void => {
				if (!cancelled) {
					setStep("invalid");
					setError(resolveAuthErrorMessage(err));
				}
			});

		return (): void => {
			cancelled = true;
		};
	}, [api.merchant.onboarding.validate, token]);

	const handleFullNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setFullName(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const handleAccountSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = MerchantOnboardingCompleteFieldsSchema.safeParse({
				token,
				fullName,
				password,
			});

			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
				return;
			}

			setIsSubmitting(true);
			void submitMerchantOnboardingComplete(API_BASE_URL, parsed.data)
				.then((response): void => {
					setBusinessName(response.businessName);
					setStep("success");
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsSubmitting(false);
				});
		},
		[fullName, password, token],
	);

	if (step === "loading") {
		return <p className="text-center text-sm text-muted-foreground">Checking your invite link…</p>;
	}

	if (step === "invalid") {
		return (
			<div className="space-y-4 text-center">
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					{error ?? "This invite link is invalid or has expired."}
				</div>
				<Button variant="outline" className="w-full" render={<Link href={loginHref} />}>
					Back to sign in
				</Button>
			</div>
		);
	}

	if (step === "success") {
		return (
			<div className="space-y-4 text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
					<svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<div className="space-y-2">
					<h2 className="text-lg font-semibold">Store ready</h2>
					<p className="text-sm text-muted-foreground">
						{businessName.length > 0 ? businessName : "Your merchant organization"} is ready. Sign in with the email from your invite, then complete business verification and
						upload KYB documents in Settings.
					</p>
				</div>
				<Button className="w-full" render={<Link href={loginUrl} />}>
					Continue to sign in
				</Button>
			</div>
		);
	}

	if (invite === null) {
		return <p className="text-center text-sm text-muted-foreground">Loading invite details…</p>;
	}

	return (
		<div className="space-y-4 sm:space-y-5">
			<div className="rounded-lg border bg-muted/30 p-3 sm:rounded-xl sm:p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Badge variant="secondary" className="text-[10px] sm:text-xs">
						{formatPilotCity(invite.city)}
					</Badge>
					<p className="text-[11px] text-muted-foreground sm:text-xs">Invite expires {formatExpiry(invite.expiresAt)}</p>
				</div>
			</div>

			<MerchantOnboardingStepper steps={ONBOARDING_STEPS} currentStepId={step} completedStepIds={completedStepIds} />

			<FormShell error={error} isLoading={isSubmitting} submitLabel="Create store" loadingLabel="Creating store…" submitClassName="h-11" onSubmit={handleAccountSubmit}>
				<div className="space-y-2">
					<Label htmlFor="merchant-onboarding-business-name">Business name</Label>
					<Input id="merchant-onboarding-business-name" value={invite.businessName} readOnly disabled className="h-11" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="merchant-onboarding-email">Work email</Label>
					<Input id="merchant-onboarding-email" value={invite.email} readOnly disabled className="h-11" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="merchant-onboarding-full-name">Your full name</Label>
					<Input id="merchant-onboarding-full-name" value={fullName} onChange={handleFullNameChange} required autoComplete="name" className="h-11" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="merchant-onboarding-password">{invite.hasExistingAccount ? "Account password" : "Password"}</Label>
					<PasswordInput
						id="merchant-onboarding-password"
						value={password}
						onChange={handlePasswordChange}
						required
						autoComplete={invite.hasExistingAccount ? "current-password" : "new-password"}
						className="h-11"
					/>
					{invite.hasExistingAccount ? (
						<p className="text-xs text-muted-foreground">This email already has an account. Enter your existing password to link this store — it will not be changed.</p>
					) : (
						<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
					)}
				</div>
			</FormShell>

			<p className="text-center text-xs text-muted-foreground sm:text-sm">
				Already have an account?{" "}
				<Link href={loginUrl} className="font-medium text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	);
}
