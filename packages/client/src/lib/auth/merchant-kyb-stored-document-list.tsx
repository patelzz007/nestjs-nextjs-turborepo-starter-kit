"use client";

import type { MerchantKybDocumentRecord } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import * as React from "react";

import { formatKybDocumentSize, formatKybScanStatus } from "./merchant-kyb-document-utils";

interface MerchantKybStoredDocumentItemProps {
	readonly document: MerchantKybDocumentRecord;
	readonly onView?: (document: MerchantKybDocumentRecord) => void;
	readonly onDownload?: (document: MerchantKybDocumentRecord) => void;
	readonly onViewSource?: (document: MerchantKybDocumentRecord) => void;
}

function MerchantKybStoredDocumentItem({ document, onView, onDownload, onViewSource }: MerchantKybStoredDocumentItemProps): React.JSX.Element {
	const handleView = React.useCallback((): void => {
		onView?.(document);
	}, [document, onView]);

	const handleDownload = React.useCallback((): void => {
		onDownload?.(document);
	}, [document, onDownload]);

	const handleViewSource = React.useCallback((): void => {
		onViewSource?.(document);
	}, [document, onViewSource]);

	const canAccess = document.scanStatus === "CLEAN";

	return (
		<li className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-2 sm:flex-row sm:items-center">
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{document.fileName}</p>
				<p className="text-xs text-muted-foreground">{formatKybDocumentSize(document.sizeBytes)}</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline">{formatKybScanStatus(document.scanStatus)}</Badge>
				{canAccess && onView !== undefined ? (
					<Button type="button" variant="outline" size="sm" onClick={handleView}>
						View
					</Button>
				) : null}
				{canAccess && onDownload !== undefined ? (
					<Button type="button" variant="outline" size="sm" onClick={handleDownload}>
						Download
					</Button>
				) : null}
				{canAccess && onViewSource !== undefined ? (
					<Button type="button" variant="ghost" size="sm" onClick={handleViewSource}>
						View source
					</Button>
				) : null}
			</div>
		</li>
	);
}

export interface MerchantKybStoredDocumentListProps {
	readonly documents: readonly MerchantKybDocumentRecord[];
	readonly onView?: (document: MerchantKybDocumentRecord) => void;
	readonly onDownload?: (document: MerchantKybDocumentRecord) => void;
	readonly onViewSource?: (document: MerchantKybDocumentRecord) => void;
	readonly className?: string;
}

export function MerchantKybStoredDocumentList({ documents, onView, onDownload, onViewSource, className }: MerchantKybStoredDocumentListProps): React.JSX.Element {
	if (documents.length === 0) {
		return <p className="text-sm text-muted-foreground">No documents on file.</p>;
	}

	return (
		<ul className={className !== undefined ? `space-y-2 ${className}` : "space-y-2"}>
			{documents.map((document) => (
				<MerchantKybStoredDocumentItem key={document.id} document={document} onView={onView} onDownload={onDownload} onViewSource={onViewSource} />
			))}
		</ul>
	);
}
