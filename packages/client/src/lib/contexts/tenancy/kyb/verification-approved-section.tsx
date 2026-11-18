"use client";

import type { MerchantKybDocumentRecord } from "@workspace/shared";
import type { JSX } from "react";

import { MerchantKybBusinessFields, MerchantKybRegistrationFields, type MerchantKybFieldValues } from "./fields";
import { MerchantKybStoredDocumentList } from "./stored-document-list";

export interface MerchantKybVerificationApprovedSectionProps {
	readonly reason: MerchantKybReadOnlyReason;
	readonly values: MerchantKybFieldValues;
	readonly storedDocuments: readonly MerchantKybDocumentRecord[];
	readonly onViewStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onDownloadStoredDocument: (document: MerchantKybDocumentRecord) => void;
	readonly onViewStoredDocumentSource: (document: MerchantKybDocumentRecord) => void;
}

/** Why the details are read-only: approved (only support changes them), or a role that may see but not submit them. */
export type MerchantKybReadOnlyReason = "approved" | "view-only";

const READ_ONLY_NOTICES: Readonly<Record<MerchantKybReadOnlyReason, string>> = {
	approved: "Your business verification is approved. The details below are read-only — contact support if any registered details need to change.",
	"view-only": "Your role can see the business verification but not change it. The tenant owner submits and updates these details.",
};

/** The submitted details and documents, read-only (the approved state, and members who may only view them). */
export function MerchantKybVerificationApprovedSection({
	reason,
	values,
	storedDocuments,
	onViewStoredDocument,
	onDownloadStoredDocument,
	onViewStoredDocumentSource,
}: MerchantKybVerificationApprovedSectionProps): JSX.Element {
	return (
		<div className="space-y-8">
			<p className="text-sm text-muted-foreground">{READ_ONLY_NOTICES[reason]}</p>
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
