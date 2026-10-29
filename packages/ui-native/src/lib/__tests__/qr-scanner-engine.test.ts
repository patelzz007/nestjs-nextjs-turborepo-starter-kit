import * as mockExpoCamera from "../../../test/expo-camera-mock";
import {
	googleScanOutcomeOfErrorCode,
	launchGoogleScanner,
	QR_BARCODE_TYPES,
	resolveQrScannerEngine,
	SCAN_CANCELLED_ERROR_CODE,
	SCAN_FAILED_ERROR_CODE,
} from "../qr-scanner-engine";

jest.mock("expo-camera", () => mockExpoCamera);

const { CameraView, emitModernScan, modernScanListeners } = mockExpoCamera;

/** An Expo native-module rejection: an Error carrying its code. */
function codedError(code: string): Error {
	return Object.assign(new Error(code), { code });
}

afterEach(() => {
	modernScanListeners.clear();
});

describe("resolveQrScannerEngine", () => {
	it("uses Google's scanner in an Android build when Play services has it", () => {
		expect(resolveQrScannerEngine({ platform: "android", isModernScannerAvailable: true, isExpoGo: false })).toBe("google");
	});

	it("uses the camera scanner inside Expo Go on Android, where Google's scanner returns to Expo Go's home", () => {
		expect(resolveQrScannerEngine({ platform: "android", isModernScannerAvailable: true, isExpoGo: true })).toBe("camera");
	});

	it("falls back to the camera scanner on Android without Play services", () => {
		expect(resolveQrScannerEngine({ platform: "android", isModernScannerAvailable: false, isExpoGo: false })).toBe("camera");
	});

	it("always uses the camera scanner on iOS, even where VisionKit's scanner exists", () => {
		expect(resolveQrScannerEngine({ platform: "ios", isModernScannerAvailable: true, isExpoGo: false })).toBe("camera");
	});
});

describe("googleScanOutcomeOfErrorCode", () => {
	it("reads the cancel code as the person backing out", () => {
		expect(googleScanOutcomeOfErrorCode(SCAN_CANCELLED_ERROR_CODE)).toEqual({ kind: "cancelled" });
	});

	it("reads a failure after the scanner opened as the person closing it (ML Kit reports the back button as one)", () => {
		expect(googleScanOutcomeOfErrorCode(SCAN_FAILED_ERROR_CODE)).toEqual({ kind: "cancelled" });
	});

	it("reads a scanner that could not open, or an unknown failure, as unavailable", () => {
		expect(googleScanOutcomeOfErrorCode("ERR_M_L_KIT_UNAVAILABLE")).toEqual({ kind: "unavailable" });
		expect(googleScanOutcomeOfErrorCode("ERR_GOOGLE_PLAY_SERVICES_UNAVAILABLE")).toEqual({ kind: "unavailable" });
		expect(googleScanOutcomeOfErrorCode(null)).toEqual({ kind: "unavailable" });
	});
});

describe("launchGoogleScanner", () => {
	it("asks for QR codes only and returns the code the scanner reported", async () => {
		CameraView.launchScanner.mockImplementationOnce((): Promise<void> => {
			emitModernScan("claim-token-123");
			return Promise.resolve();
		});

		await expect(launchGoogleScanner()).resolves.toEqual({ kind: "scanned", data: "claim-token-123" });
		expect(CameraView.launchScanner).toHaveBeenCalledWith({ barcodeTypes: [...QR_BARCODE_TYPES] });
	});

	it("reports a cancel when the scanner closes without a code", async () => {
		CameraView.launchScanner.mockResolvedValueOnce(undefined);

		await expect(launchGoogleScanner()).resolves.toEqual({ kind: "cancelled" });
	});

	it("maps a rejection to cancelled or unavailable by its code", async () => {
		CameraView.launchScanner.mockRejectedValueOnce(codedError(SCAN_CANCELLED_ERROR_CODE));
		await expect(launchGoogleScanner()).resolves.toEqual({ kind: "cancelled" });

		CameraView.launchScanner.mockRejectedValueOnce(codedError("ERR_GOOGLE_PLAY_SERVICES_UNAVAILABLE"));
		await expect(launchGoogleScanner()).resolves.toEqual({ kind: "unavailable" });

		CameraView.launchScanner.mockRejectedValueOnce("not an error");
		await expect(launchGoogleScanner()).resolves.toEqual({ kind: "unavailable" });
	});

	it("removes its listener whatever happens", async () => {
		CameraView.launchScanner.mockRejectedValueOnce(codedError(SCAN_CANCELLED_ERROR_CODE));

		await launchGoogleScanner();

		expect(modernScanListeners.size).toBe(0);
	});
});
