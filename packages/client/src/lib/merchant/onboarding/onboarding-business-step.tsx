"use client";

import type { MerchantBusinessCategory } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import type { JSX, SyntheticEvent } from "react";

import { MerchantKybBusinessFields, type MerchantKybBusinessFieldName, type MerchantKybFieldValues } from "../kyb/fields";
import { MerchantCategoryPicker } from "./category-picker";

/** The business fields `MerchantKybBusinessFields` can edit. */
export type BusinessFieldName = MerchantKybBusinessFieldName;

export interface MerchantOnboardingBusinessStepProps {
	readonly category: MerchantBusinessCategory;
	readonly values: MerchantKybFieldValues;
	readonly onCategoryChange: (value: MerchantBusinessCategory) => void;
	readonly onBusinessFieldChange: (field: BusinessFieldName, value: string) => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function MerchantOnboardingBusinessStep({ category, values, onCategoryChange, onBusinessFieldChange, onSubmit }: MerchantOnboardingBusinessStepProps): JSX.Element {
	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<div className="space-y-3">
				<Label>Business category</Label>
				<MerchantCategoryPicker value={category} onChange={onCategoryChange} />
			</div>
			<MerchantKybBusinessFields
				values={values}
				onChange={onBusinessFieldChange}
				idPrefix="merchant-onboarding"
				showBusinessName={false}
				showAddress={false}
				showContactPhone={false}
			/>
			<div className="flex justify-end">
				<Button type="submit" className="h-11 sm:min-w-36">
					Continue
				</Button>
			</div>
		</form>
	);
}
