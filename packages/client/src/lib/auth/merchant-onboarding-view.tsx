"use client";

import type { MerchantOnboardingInvitePreview } from "@workspace/shared";
import { MerchantOnboardingCompleteSchema } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { MerchantKybFields, type MerchantKybFieldValues } from "./merchant-kyb-fields";
import { passwordStrength } from "./password";

type OnboardingStep = "loading" | "invalid" | "account" | "kyb" | "success";

const EMPTY_KYB_VALUES: MerchantKybFieldValues = {
	legalName: "",
	addressText: "",
	contactPhone: "",
	registrationNo: "",
	taxId: "",
	documentType: "",
};

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
	const completeMutation = api.merchant.onboarding.complete.useMutation();

	const [step, setStep] = useState<OnboardingStep>("loading");
	const [error, setError] = useState<string | null>(null);
	const [invite, setInvite] = useState<MerchantOnboardingInvitePreview | null>(null);
	const [fullName, setFullName] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [kybValues, setKybValues] = useState<MerchantKybFieldValues>(EMPTY_KYB_VALUES);
	const [businessName, setBusinessName] = useState<string>("");

	const strength = useMemo(() => passwordStrength(password), [password]);

	const loginUrl = useMemo((): string => {
		if (invite === null) {
			return loginHref;
		}
		const params = new URLSearchParams({ email: invite.email });
		return `${loginHref}?${params.toString()}`;
	}, [invite, loginHref]);

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

	const handleKybFieldChange = useCallback((field: keyof MerchantKybFieldValues, value: string): void => {
		setKybValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleAccountContinue = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			if (fullName.trim().length < 2) {
				setError("Enter your full name.");
				return;
			}

			if (password.length === 0) {
				setError("Enter a password.");
				return;
			}

			setStep("kyb");
		},
		[fullName, password],
	);

	const handleKybSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = MerchantOnboardingCompleteSchema.safeParse({
				token,
				fullName,
				password,
				...kybValues,
			});

			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
				return;
			}

			void completeMutation
				.mutateAsync(parsed.data)
				.then((response): void => {
					setBusinessName(response.data.businessName);
					setStep("success");
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[completeMutation, fullName, kybValues, password, token],
	);

	const handleBackToAccount = useCallback((): void => {
		setError(null);
		setStep("account");
	}, []);

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
						{businessName.length > 0 ? businessName : "Your merchant organization"} is set up with business verification submitted for review. Sign in with the email from your
						invite to open the merchant portal.
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
		<div className="space-y-6">
			<div className="rounded-xl border bg-muted/30 p-4">
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
						<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
						</svg>
					</div>
					<div className="min-w-0 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium break-words">{invite.businessName}</p>
							<Badge variant="secondary">{formatPilotCity(invite.city)}</Badge>
						</div>
						<p className="text-sm break-words text-muted-foreground">{invite.email}</p>
						<p className="text-xs text-muted-foreground">Invite expires {formatExpiry(invite.expiresAt)}</p>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				<span className={step === "account" ? "text-primary" : ""}>1. Account</span>
				<span aria-hidden="true">→</span>
				<span className={step === "kyb" ? "text-primary" : ""}>2. Business verification</span>
			</div>

			{step === "account" ? (
				<FormShell error={error} isLoading={false} submitLabel="Continue" loadingLabel="Continue" submitClassName="h-11" onSubmit={handleAccountContinue}>
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
			) : (
				<FormShell
					error={error}
					isLoading={completeMutation.isPending}
					submitLabel="Submit and create store"
					loadingLabel="Creating store…"
					submitClassName="h-11"
					onSubmit={handleKybSubmit}>
					<p className="text-sm text-muted-foreground">Provide your registered business details for platform KYB review. These appear in the admin verification queue.</p>
					<MerchantKybFields values={kybValues} onChange={handleKybFieldChange} idPrefix="merchant-onboarding" />
					<Button type="button" variant="outline" className="h-11 w-full" onClick={handleBackToAccount}>
						Back
					</Button>
				</FormShell>
			)}

			<p className="text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href={loginUrl} className="font-medium text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	);
}
