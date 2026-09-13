"use client";

import type { MerchantKybDocumentRecord } from "@workspace/shared";
import type { JSX } from "react";

import { MerchantKybBusinessFields, MerchantKybRegistrationFields, type MerchantKybFieldValues } from "./fields";
import { MerchantKybStoredDocumentList } from "./stored-document-list";

export interface MerchantKybVerificationApprovedSectionProps {
	readonly values: MerchantKybFieldValues;
	readonly storedDocuments: readonly MerchantKybDocumentRecord[];
	readonly onViewStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onDownloadStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onViewStoredDocumentSource: (document: MerchantKybDocumentRecord) => void;
}

export function MerchantKybVerificationApprovedSection({
	values,
	storedDocuments,
	onViewStoredDocument,
	onDownloadStoredDocument,
	onViewStoredDocumentSource,
}: MerchantKybVerificationApprovedSectionProps): JSX.Element {
	return (
		<div className="space-y-8">
			<p className="text-sm text-muted-foreground">
				Your business verification is approved. The details below are read-only — contact support if any registered details need to change.
			</p>
			<section className="space-y-4">
				<h2 className="text-sm font-semibold">Business details</h2>
				<MerchantKybBusinessFields values={values} idPrefix="merchant-verification" readOnly />
			</section>
			<section className="space-y-4">
				<h2 className="text-sm font-semibold">Registration details</h2>
				<MerchantKybRegistrationFields values={values} idPrefix="merchant-verification" readOnly />
			</section>
			<section className="space-y-4">
				<h2 className="text-sm font-semibold">Business registration documents</h2>
				<MerchantKybStoredDocumentList
					documents={storedDocuments}
					onView={onViewStoredDocument}
					onDownload={onDownloadStoredDocument}
					onViewSource={onViewStoredDocumentSource}
				/>
			</section>
		</div>
	);
}
