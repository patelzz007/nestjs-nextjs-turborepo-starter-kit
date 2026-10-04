import { KybDocumentScanStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { kybDocumentScanDisplay } from "@/lib/merchants/kyb-document-scan";

describe("kybDocumentScanDisplay", () => {
	it("labels every scan status of the shared enum distinctly", () => {
		const labels = KybDocumentScanStatusSchema.options.map((status) => kybDocumentScanDisplay(status).label);
		expect(labels).toEqual(["Scanning", "Clean", "Not scanned", "Infected", "Scan failed"]);
	});

	it("never shows a blocked or unchecked document as clean", () => {
		expect(kybDocumentScanDisplay("INFECTED").variant).toBe("destructive");
		expect(kybDocumentScanDisplay("SCAN_FAILED").variant).toBe("destructive");
		expect(kybDocumentScanDisplay("NOT_SCANNED").label).not.toBe("Clean");
	});
});
