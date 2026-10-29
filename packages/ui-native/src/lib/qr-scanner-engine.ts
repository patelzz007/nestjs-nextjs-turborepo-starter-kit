// Which scanner reads a QR code on this device, and the one that is the
// operating system's own: Google's code scanner (ML Kit, Google Play
// services) on Android — the full-screen scanner Google ships, with no camera
// permission because Play services owns the camera. Everywhere else — iOS,
// an Android phone without Play services, and Expo Go on Android — the kit's own full-screen
// camera scanner (`QrScanner`'s viewfinder over expo-camera's `CameraView`,
// itself ML Kit on Android and AVFoundation on iOS). iOS's VisionKit scanner
// is not used: it has no close button and cannot be styled.
//
// Why not Google's scanner in Expo Go: Expo Go runs each project in its own
// Android task, and expo-camera starts Google's scanner from the application
// context, so Android opens it in a new task. When it closes, the person
// lands on Expo Go's home instead of back in the app (which is still
// running, behind it in Recents). A real build has one task, so it is not
// affected.

import { CameraView, type BarcodeType, type ScanningResult } from "expo-camera";
import { z } from "zod";

/** `google`: Google's code scanner (Android with Play services). `camera`: the kit's camera scanner. */
export const QrScannerEngineSchema = z.enum(["google", "camera"]);

export type QrScannerEngine = z.output<typeof QrScannerEngineSchema>;

/** Only QR codes are looked for: no other symbology can be misread as one. */
export const QR_BARCODE_TYPES: readonly BarcodeType[] = ["qr"];

export interface QrScannerEngineInput {
	readonly platform: string;
	/** expo-camera's `CameraView.isModernBarcodeScannerAvailable` (Android: ML Kit and Play services present). */
	readonly isModernScannerAvailable: boolean;
	/** The app runs inside Expo Go (`Constants.executionEnvironment === StoreClient`), not as its own build. */
	readonly isExpoGo: boolean;
}

const ANDROID_PLATFORM = "android";

/** Google's scanner where an Android build has it; the kit's camera scanner otherwise (and always inside Expo Go). */
export function resolveQrScannerEngine({ platform, isModernScannerAvailable, isExpoGo }: QrScannerEngineInput): QrScannerEngine {
	return platform === ANDROID_PLATFORM && isModernScannerAvailable && !isExpoGo ? "google" : "camera";
}

/** How a run of Google's scanner ended: a code, the person backed out, or the scanner could not run (fall back to the camera). */
export type GoogleScanOutcome = { readonly kind: "scanned"; readonly data: string } | { readonly kind: "cancelled" } | { readonly kind: "unavailable" };

/** The code expo-camera rejects with when ML Kit cancels the scan task (its X, on some ML Kit versions). */
export const SCAN_CANCELLED_ERROR_CODE = "ERR_BARCODE_SCANNING_CANCELLED";

/**
 * The code expo-camera (58.0.x) rejects with for EVERY failure ML Kit reports once its scanner was
 * asked to open — and ML Kit reports the person leaving it as a failure: the system back button as
 * `INTERNAL` (13), the X as `CODE_SCANNER_CANCELLED` (201) on some versions. expo-camera passes no
 * ML Kit code on, so this cannot be told apart from a scanner that failed while opening (its module
 * still downloading on an app installed outside the Play Store). It is read as the person closing
 * it: the scanner closes and a second tap tries again. A scanner that could not open at all —
 * Play services or ML Kit missing — is rejected with its own codes before it opens, and only those
 * fall back to the camera scanner.
 */
export const SCAN_FAILED_ERROR_CODE = "ERR_BARCODE_SCANNING_FAILED";

/** The codes that mean Google's scanner was open and is now closed, without a code. */
const ScanClosedErrorCodeSchema = z.enum([SCAN_CANCELLED_ERROR_CODE, SCAN_FAILED_ERROR_CODE]);

/** A rejection from an Expo native module: an error carrying its code. */
const CodedErrorSchema = z.object({ code: z.string() });

/** What a rejected `launchScanner` means, from its error code: Google's scanner was open and closed, or it could not open (no Play services, ML Kit missing, anything unknown). */
export function googleScanOutcomeOfErrorCode(code: string | null): GoogleScanOutcome {
	return ScanClosedErrorCodeSchema.safeParse(code).success ? { kind: "cancelled" } : { kind: "unavailable" };
}

/**
 * Opens Google's scanner and waits for it to close. The code arrives as an
 * event just before `launchScanner` resolves, so the listener is in place
 * first and removed whatever happens.
 */
export async function launchGoogleScanner(): Promise<GoogleScanOutcome> {
	const received: { data: string | null } = { data: null };
	const subscription = CameraView.onModernBarcodeScanned((result: ScanningResult): void => {
		received.data = result.data;
	});
	try {
		await CameraView.launchScanner({ barcodeTypes: [...QR_BARCODE_TYPES] });
		return received.data === null ? { kind: "cancelled" } : { kind: "scanned", data: received.data };
	} catch (error: unknown) {
		return googleScanOutcomeOfErrorCode(CodedErrorSchema.safeParse(error).data?.code ?? null);
	} finally {
		subscription.remove();
	}
}
