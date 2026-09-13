"use client";

import { Button } from "@workspace/ui/components/form/button";
import type { JSX, SyntheticEvent } from "react";

import { MerchantKybDocumentUpload } from "../kyb/document-upload";
import type { MerchantKybFieldValues } from "../kyb/fields";

export interface MerchantOnboardingDocumentsStepProps {
	readonly documents: MerchantKybFieldValues["documents"];
	readonly onDocumentsChange: (documents: MerchantKybFieldValues["documents"]) => void;
	readonly onBack: () => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function MerchantOnboardingDocumentsStep({ documents, onDocumentsChange, onBack, onSubmit }: MerchantOnboardingDocumentsStepProps): JSX.Element {
	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<MerchantKybDocumentUpload documents={documents} onChange={onDocumentsChange} idPrefix="merchant-onboarding-documents" />
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
