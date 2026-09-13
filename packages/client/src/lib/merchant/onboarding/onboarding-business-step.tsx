"use client";

import type { MerchantBusinessCategory } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Label } from "@workspace/ui/components/form/label";
import type { JSX, SyntheticEvent } from "react";

import { MerchantKybBusinessFields, type MerchantKybFieldValues } from "../kyb/fields";
import { MerchantCategoryPicker } from "./category-picker";

export interface MerchantOnboardingBusinessStepProps {
	readonly category: MerchantBusinessCategory;
	readonly values: MerchantKybFieldValues;
	readonly onCategoryChange: (value: MerchantBusinessCategory) => void;
	readonly onBusinessFieldChange: (field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string) => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function MerchantOnboardingBusinessStep({ category, values, onCategoryChange, onBusinessFieldChange, onSubmit }: MerchantOnboardingBusinessStepProps): JSX.Element {
	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<div className="space-y-3">
				<Label>Business category</Label>
				<MerchantCategoryPicker value={category} onChange={onCategoryChange} />
			</div>
			<MerchantKybBusinessFields values={values} onChange={onBusinessFieldChange} idPrefix="merchant-onboarding" showBusinessName={false} />
			<div className="flex justify-end">
				<Button type="submit" className="h-11 sm:min-w-36">
					Continue
				</Button>
			</div>
		</form>
	);
}
