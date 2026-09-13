"use client";

import { Button } from "@workspace/ui/components/form/button";
import type { JSX, SyntheticEvent } from "react";

import { MerchantKybRegistrationFields, type MerchantKybFieldValues } from "../kyb/fields";

export interface MerchantOnboardingRegistrationStepProps {
	readonly values: MerchantKybFieldValues;
	readonly onRegistrationFieldChange: (field: "registrationNo" | "taxId" | "documentType", value: string) => void;
	readonly onBack: () => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function MerchantOnboardingRegistrationStep({ values, onRegistrationFieldChange, onBack, onSubmit }: MerchantOnboardingRegistrationStepProps): JSX.Element {
	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<MerchantKybRegistrationFields values={values} onChange={onRegistrationFieldChange} idPrefix="merchant-onboarding" />
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
				<Button type="button" variant="outline" className="h-11" onClick={onBack}>
					Back
				</Button>
				<Button type="submit" className="h-11 sm:min-w-36">
					Continue
				</Button>
			</div>
		</form>
	);
}
