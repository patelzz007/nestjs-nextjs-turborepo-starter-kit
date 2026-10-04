import type { KybDocumentScanStatus } from "@workspace/shared";

/** How a scan status is shown: its label, badge style and what it means for the reviewer. */
export interface KybDocumentScanDisplay {
	readonly label: string;
	readonly variant: "default" | "secondary" | "outline" | "destructive";
	readonly description: string;
}

/**
 * Every document scan status → its badge. Typed to the shared enum, so a new
 * status is a compile error here until it is given a label — it can never
 * fall through to a misleading "Ready".
 */
export const KYB_DOCUMENT_SCAN_DISPLAY: Readonly<Record<KybDocumentScanStatus, KybDocumentScanDisplay>> = {
	SCANNING: { label: "Scanning", variant: "outline", description: "The virus scan is running; the document opens once it is clean." },
	CLEAN: { label: "Clean", variant: "secondary", description: "Scanned, no threat found." },
	NOT_SCANNED: { label: "Not scanned", variant: "outline", description: "No scanner is configured, so this document was not checked — open it with care." },
	INFECTED: { label: "Infected", variant: "destructive", description: "The scanner found a threat; the document is blocked." },
	SCAN_FAILED: { label: "Scan failed", variant: "destructive", description: "The scan could not complete; the document is blocked until it is rescanned." },
};

/** The badge of one scan status. */
export function kybDocumentScanDisplay(status: KybDocumentScanStatus): KybDocumentScanDisplay {
	return KYB_DOCUMENT_SCAN_DISPLAY[status];
}
