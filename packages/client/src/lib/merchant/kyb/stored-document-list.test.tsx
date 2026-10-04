// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { epochMs, KybDocumentScanStatusSchema, type KybDocumentScanStatus, type MerchantKybDocumentRecord } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatKybScanStatus, isKybDocumentAccessible } from "./document-utils";
import { MerchantKybStoredDocumentList } from "./stored-document-list";

function documentWith(scanStatus: KybDocumentScanStatus): MerchantKybDocumentRecord {
	return { id: "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f", fileName: "registration.pdf", mimeType: "application/pdf", sizeBytes: 2048, scanStatus, uploadedAt: epochMs(0) };
}

afterEach(() => {
	cleanup();
});

const EXPECTED: Readonly<Record<KybDocumentScanStatus, { readonly label: string; readonly accessible: boolean }>> = {
	SCANNING: { label: "Scanning", accessible: false },
	CLEAN: { label: "Ready", accessible: true },
	NOT_SCANNED: { label: "Not malware-checked", accessible: true },
	INFECTED: { label: "Action required", accessible: false },
	SCAN_FAILED: { label: "Scan failed – re-upload", accessible: false },
};

describe("KYB document scan status", () => {
	it.each(KybDocumentScanStatusSchema.options)("%s has a label and an access rule", (status: KybDocumentScanStatus) => {
		expect(formatKybScanStatus(status)).toBe(EXPECTED[status].label);
		expect(isKybDocumentAccessible(status)).toBe(EXPECTED[status].accessible);
	});

	it.each(KybDocumentScanStatusSchema.options)(
		"%s: the list offers view/download exactly when the document is accessible, with its badge",
		(status: KybDocumentScanStatus) => {
			render(<MerchantKybStoredDocumentList documents={[documentWith(status)]} onView={vi.fn()} onDownload={vi.fn()} />);

			expect(screen.getByText(EXPECTED[status].label)).toBeDefined();
			expect(screen.queryByRole("button", { name: "Download" }) !== null).toBe(EXPECTED[status].accessible);
			expect(screen.queryByRole("button", { name: "View" }) !== null).toBe(EXPECTED[status].accessible);
		},
	);
});
