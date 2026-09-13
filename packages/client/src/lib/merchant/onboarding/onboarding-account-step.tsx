"use client";

import type { MerchantOnboardingInvitePreview } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import type { ChangeEvent, JSX, SyntheticEvent } from "react";

import type { PasswordStrengthResult } from "../../auth/password";

export interface MerchantOnboardingAccountStepProps {
	readonly invite: MerchantOnboardingInvitePreview;
	readonly fullName: string;
	readonly password: string;
	readonly documentCount: number;
	readonly strength: PasswordStrengthResult;
	readonly isSubmitting: boolean;
	readonly onFullNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
	readonly onPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
	readonly onBack: () => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function MerchantOnboardingAccountStep({
	invite,
	fullName,
	password,
	documentCount,
	strength,
	isSubmitting,
	onFullNameChange,
	onPasswordChange,
	onBack,
	onSubmit,
}: MerchantOnboardingAccountStepProps): JSX.Element {
	return (
		<form className="space-y-5" onSubmit={onSubmit}>
			<div className="space-y-2">
				<Label htmlFor="merchant-onboarding-full-name">Your full name</Label>
				<Input id="merchant-onboarding-full-name" value={fullName} onChange={onFullNameChange} required autoComplete="name" className="h-11" />
			</div>
			<div className="space-y-2">
				<Label htmlFor="merchant-onboarding-password">{invite.hasExistingAccount ? "Account password" : "Create a password"}</Label>
				<PasswordInput
					id="merchant-onboarding-password"
					value={password}
					onChange={onPasswordChange}
					required
					autoComplete={invite.hasExistingAccount ? "current-password" : "new-password"}
					className="h-11"
				/>
				{invite.hasExistingAccount ? (
					<p className="text-xs text-muted-foreground">Enter your existing password to link this merchant application.</p>
				) : (
					<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
				)}
			</div>
			<div className="rounded-xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
				Submitting creates your owner account and sends all business details and {String(documentCount)} document(s) to the admin review queue.
			</div>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
				<Button type="button" variant="outline" className="h-11" disabled={isSubmitting} onClick={onBack}>
					Back
				</Button>
				<Button type="submit" className="h-11 sm:min-w-44" loading={isSubmitting} disabled={isSubmitting}>
					{isSubmitting ? "Submitting application…" : "Submit for review"}
				</Button>
			</div>
		</form>
	);
}
