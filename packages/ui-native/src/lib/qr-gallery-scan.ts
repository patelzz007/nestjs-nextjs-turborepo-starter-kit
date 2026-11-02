// Reading a QR code from a photo instead of the camera: the person picks an image from their library
// (expo-image-picker, the system photo picker — no media permission on Android 13+ or iOS 14+), and
// expo-camera decodes it with the same engine as the live scanner (ML Kit on Android, Vision on iOS).
// Both of the kit's scanners offer it: inside the camera scanner's overlay, and — because Google's
// code scanner draws its own screen with no room for ours — as `QrScanFromGalleryButton` beside it.

import { scanFromURLAsync, type BarcodeScanningResult } from "expo-camera";
import { launchImageLibraryAsync, type ImagePickerResult } from "expo-image-picker";

import { QR_BARCODE_TYPES } from "./qr-scanner-engine";

/** How a scan from the photo library ended. */
export type GalleryScanOutcome =
	| { readonly kind: "scanned"; readonly data: string }
	/** The person closed the picker without choosing a photo. */
	| { readonly kind: "cancelled" }
	/** The photo holds no QR code the decoder could read. */
	| { readonly kind: "no-code" }
	/** The photo could not be opened or decoded at all. */
	| { readonly kind: "failed" };

/** What the library scan needs from the device: a picker and a decoder (both replaceable in tests). */
export interface GalleryScanDevice {
	readonly pickImage: () => Promise<ImagePickerResult>;
	readonly decode: (uri: string) => Promise<readonly BarcodeScanningResult[]>;
}

/** The photo as taken: a smaller copy can lose the code's finer modules. */
const FULL_QUALITY = 1;

/** The device's own picker (images only, no editing) and expo-camera's decoder (QR codes only). */
export const DEVICE_GALLERY_SCAN: GalleryScanDevice = {
	pickImage: (): Promise<ImagePickerResult> => launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: FULL_QUALITY, exif: false }),
	decode: (uri: string): Promise<readonly BarcodeScanningResult[]> => scanFromURLAsync(uri, [...QR_BARCODE_TYPES]),
};

/** The first readable code of a decode, or null when the photo held none. */
export function firstQrData(results: readonly BarcodeScanningResult[]): string | null {
	const [first] = results.filter((result: BarcodeScanningResult): boolean => result.data.length > 0);
	return first?.data ?? null;
}

/** Pick a photo and read the QR code in it. Never throws: every ending is an outcome. */
export async function scanQrFromGallery(device: GalleryScanDevice = DEVICE_GALLERY_SCAN): Promise<GalleryScanOutcome> {
	try {
		const picked = await device.pickImage();
		if (picked.canceled) {
			return { kind: "cancelled" };
		}
		const [asset] = picked.assets;
		if (asset === undefined) {
			return { kind: "cancelled" };
		}
		const data = firstQrData(await device.decode(asset.uri));
		return data === null ? { kind: "no-code" } : { kind: "scanned", data };
	} catch {
		return { kind: "failed" };
	}
}
