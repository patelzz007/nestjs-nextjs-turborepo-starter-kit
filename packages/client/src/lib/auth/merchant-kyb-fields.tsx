"use client";

import type { MerchantKybPendingDocument } from "./merchant-kyb-pending-document";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import * as React from "react";

import { MerchantKybDocumentUpload } from "./merchant-kyb-document-upload";

export interface MerchantKybFieldValues {
	readonly businessName: string;
	readonly legalName: string;
	readonly addressText: string;
	readonly contactPhone: string;
	readonly registrationNo: string;
	readonly taxId: string;
	readonly documentType: string;
	readonly documents: MerchantKybPendingDocument[];
}

export interface MerchantKybBusinessFieldsProps {
	readonly values: Pick<MerchantKybFieldValues, "businessName" | "legalName" | "addressText" | "contactPhone">;
	readonly onChange?: (field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string) => void;
	readonly idPrefix?: string;
	readonly readOnly?: boolean;
	/** When false, hides the store name field. @default true */
	readonly showBusinessName?: boolean;
	/** When true, store name is shown but cannot be edited (onboarding invite). @default false */
	readonly businessNameReadOnly?: boolean;
	/** When false, hides registered legal name. @default true */
	readonly showLegalName?: boolean;
}

export interface MerchantKybRegistrationFieldsProps {
	readonly values: Pick<MerchantKybFieldValues, "registrationNo" | "taxId" | "documentType">;
	readonly onChange?: (field: "registrationNo" | "taxId" | "documentType", value: string) => void;
	readonly idPrefix?: string;
	readonly readOnly?: boolean;
}

export interface MerchantKybFieldsProps {
	readonly values: MerchantKybFieldValues;
	readonly onChange: (field: keyof MerchantKybFieldValues, value: string | MerchantKybPendingDocument[]) => void;
	readonly idPrefix?: string;
	readonly showDocuments?: boolean;
}

export function MerchantKybBusinessFields({
	values,
	onChange,
	idPrefix = "merchant-kyb",
	readOnly = false,
	showBusinessName = true,
	businessNameReadOnly = false,
	showLegalName = true,
}: MerchantKybBusinessFieldsProps): React.JSX.Element {
	const isBusinessNameLocked = readOnly || businessNameReadOnly;

	const handleBusinessNameChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("businessName", event.target.value);
		},
		[onChange],
	);

	const handleLegalNameChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("legalName", event.target.value);
		},
		[onChange],
	);

	const handleAddressChange = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
			onChange?.("addressText", event.target.value);
		},
		[onChange],
	);

	const handleContactPhoneChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("contactPhone", event.target.value);
		},
		[onChange],
	);

	return (
		<div className="space-y-4">
			{showBusinessName ? (
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-business-name`}>Business name</Label>
					<Input
						id={`${idPrefix}-business-name`}
						value={values.businessName}
						onChange={handleBusinessNameChange}
						readOnly={isBusinessNameLocked}
						disabled={isBusinessNameLocked}
						required={!isBusinessNameLocked}
						autoComplete="organization"
						className="h-11"
						placeholder="Sunrise Café"
					/>
					{businessNameReadOnly ? (
						<p className="text-xs text-muted-foreground">Set on your invite by the platform admin. Update later from Settings → Verification if needed.</p>
					) : null}
				</div>
			) : null}
			{showLegalName ? (
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-legal-name`}>Registered legal name</Label>
					<Input
						id={`${idPrefix}-legal-name`}
						value={values.legalName}
						onChange={handleLegalNameChange}
						readOnly={readOnly}
						disabled={readOnly}
						required={!readOnly}
						autoComplete="organization"
						className="h-11"
						placeholder="Brew & Bean KL Sdn Bhd"
					/>
				</div>
			) : null}
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-address`}>Business address</Label>
				<Textarea
					id={`${idPrefix}-address`}
					value={values.addressText}
					onChange={handleAddressChange}
					readOnly={readOnly}
					disabled={readOnly}
					required={!readOnly}
					rows={3}
					placeholder="Street, city, postcode"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-contact-phone`}>Contact phone</Label>
				<Input
					id={`${idPrefix}-contact-phone`}
					value={values.contactPhone}
					onChange={handleContactPhoneChange}
					readOnly={readOnly}
					disabled={readOnly}
					required={!readOnly}
					autoComplete="tel"
					className="h-11"
					placeholder="+60321456789"
				/>
			</div>
		</div>
	);
}

export function MerchantKybRegistrationFields({ values, onChange, idPrefix = "merchant-kyb", readOnly = false }: MerchantKybRegistrationFieldsProps): React.JSX.Element {
	const handleRegistrationNoChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("registrationNo", event.target.value);
		},
		[onChange],
	);

	const handleTaxIdChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("taxId", event.target.value);
		},
		[onChange],
	);

	const handleDocumentTypeChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.("documentType", event.target.value);
		},
		[onChange],
	);

	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-registration-no`}>SSM / registration number</Label>
					<Input
						id={`${idPrefix}-registration-no`}
						value={values.registrationNo}
						onChange={handleRegistrationNoChange}
						readOnly={readOnly}
						disabled={readOnly}
						required={!readOnly}
						className="h-11"
						placeholder="201901012345"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-tax-id`}>Tax ID</Label>
					<Input
						id={`${idPrefix}-tax-id`}
						value={values.taxId}
						onChange={handleTaxIdChange}
						readOnly={readOnly}
						disabled={readOnly}
						required={!readOnly}
						className="h-11"
						placeholder="C12345678"
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-document-type`}>Primary document type</Label>
				<Input
					id={`${idPrefix}-document-type`}
					value={values.documentType}
					onChange={handleDocumentTypeChange}
					readOnly={readOnly}
					disabled={readOnly}
					required={!readOnly}
					className="h-11"
					placeholder="SSM certificate"
				/>
				{readOnly ? null : <p className="text-xs text-muted-foreground">Describe the main registration document you are uploading in the next step.</p>}
			</div>
		</div>
	);
}

export function MerchantKybFields({ values, onChange, idPrefix = "merchant-kyb", showDocuments = true }: MerchantKybFieldsProps): React.JSX.Element {
	const handleBusinessChange = React.useCallback(
		(field: "businessName" | "legalName" | "addressText" | "contactPhone", value: string): void => {
			onChange(field, value);
		},
		[onChange],
	);

	const handleRegistrationChange = React.useCallback(
		(field: "registrationNo" | "taxId" | "documentType", value: string): void => {
			onChange(field, value);
		},
		[onChange],
	);

	const handleDocumentsChange = React.useCallback(
		(documents: MerchantKybPendingDocument[]): void => {
			onChange("documents", documents);
		},
		[onChange],
	);

	return (
		<div className="space-y-6">
			<MerchantKybBusinessFields values={values} onChange={handleBusinessChange} idPrefix={idPrefix} />
			<MerchantKybRegistrationFields values={values} onChange={handleRegistrationChange} idPrefix={idPrefix} />
			{showDocuments ? <MerchantKybDocumentUpload documents={values.documents} onChange={handleDocumentsChange} idPrefix={`${idPrefix}-documents`} /> : null}
		</div>
	);
}
