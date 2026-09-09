"use client";

import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import * as React from "react";

export interface MerchantKybFieldValues {
	readonly legalName: string;
	readonly addressText: string;
	readonly contactPhone: string;
	readonly registrationNo: string;
	readonly taxId: string;
	readonly documentType: string;
}

export interface MerchantKybFieldsProps {
	readonly values: MerchantKybFieldValues;
	readonly onChange: (field: keyof MerchantKybFieldValues, value: string) => void;
	readonly idPrefix?: string;
}

export function MerchantKybFields({ values, onChange, idPrefix = "merchant-kyb" }: MerchantKybFieldsProps): React.JSX.Element {
	const handleLegalNameChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange("legalName", event.target.value);
		},
		[onChange],
	);

	const handleAddressChange = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
			onChange("addressText", event.target.value);
		},
		[onChange],
	);

	const handleContactPhoneChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange("contactPhone", event.target.value);
		},
		[onChange],
	);

	const handleRegistrationNoChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange("registrationNo", event.target.value);
		},
		[onChange],
	);

	const handleTaxIdChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange("taxId", event.target.value);
		},
		[onChange],
	);

	const handleDocumentTypeChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange("documentType", event.target.value);
		},
		[onChange],
	);

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-legal-name`}>Registered legal name</Label>
				<Input
					id={`${idPrefix}-legal-name`}
					value={values.legalName}
					onChange={handleLegalNameChange}
					required
					autoComplete="organization"
					className="h-11"
					placeholder="Brew & Bean KL Sdn Bhd"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-address`}>Business address</Label>
				<Textarea id={`${idPrefix}-address`} value={values.addressText} onChange={handleAddressChange} required rows={3} placeholder="Street, city, postcode" />
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-contact-phone`}>Contact phone</Label>
				<Input
					id={`${idPrefix}-contact-phone`}
					value={values.contactPhone}
					onChange={handleContactPhoneChange}
					required
					autoComplete="tel"
					className="h-11"
					placeholder="+60321456789"
				/>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-registration-no`}>SSM / registration number</Label>
					<Input id={`${idPrefix}-registration-no`} value={values.registrationNo} onChange={handleRegistrationNoChange} required className="h-11" placeholder="201901012345" />
				</div>
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-tax-id`}>Tax ID</Label>
					<Input id={`${idPrefix}-tax-id`} value={values.taxId} onChange={handleTaxIdChange} required className="h-11" placeholder="C12345678" />
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-document-type`}>Document type</Label>
				<Input id={`${idPrefix}-document-type`} value={values.documentType} onChange={handleDocumentTypeChange} required className="h-11" placeholder="SSM certificate" />
				<p className="text-xs text-muted-foreground">Describe the business registration document you will provide if requested during review.</p>
			</div>
		</div>
	);
}
