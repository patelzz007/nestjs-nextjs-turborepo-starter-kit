import { scanStatusOf, VIEWFINDER_MAX_SIDE, VIEWFINDER_MIN_SIDE, viewfinderLayout, type ScanStatusLabels } from "../qr-viewfinder";

const LABELS: ScanStatusLabels = {
	startingCamera: "Starting the camera…",
	hint: "Point your camera at a QR code",
	slowHint: "Move closer",
	found: "QR code found",
	cameraFailed: "The camera couldn't start",
};

describe("viewfinderLayout", () => {
	it("frames 68% of a phone's width, centred across, its middle at 42% of the height", () => {
		expect(viewfinderLayout(390, 844)).toEqual({ side: 265, left: 63, top: 222, cutoutBorder: 844 });
	});

	it("never shrinks below the smallest window, nor grows past the largest", () => {
		expect(viewfinderLayout(240, 300).side).toBe(VIEWFINDER_MIN_SIDE);
		expect(viewfinderLayout(1024, 1366).side).toBe(VIEWFINDER_MAX_SIDE);
	});

	it("keeps the window on screen when the screen is short", () => {
		expect(viewfinderLayout(800, 200).top).toBe(0);
	});
});

describe("scanStatusOf", () => {
	it("says what the scanner is doing in each phase", () => {
		expect(scanStatusOf("starting", LABELS, null)).toBe(LABELS.startingCamera);
		expect(scanStatusOf("searching", LABELS, null)).toBe(LABELS.hint);
		expect(scanStatusOf("slow", LABELS, null)).toBe(LABELS.slowHint);
		expect(scanStatusOf("locked", LABELS, null)).toBe(LABELS.found);
		expect(scanStatusOf("failed", LABELS, null)).toBe(LABELS.cameraFailed);
	});

	it("shows what came of a photo instead, until a code is found", () => {
		expect(scanStatusOf("searching", LABELS, "No QR code in that photo")).toBe("No QR code in that photo");
		expect(scanStatusOf("failed", LABELS, "No QR code in that photo")).toBe("No QR code in that photo");
		expect(scanStatusOf("locked", LABELS, "No QR code in that photo")).toBe(LABELS.found);
	});
});
