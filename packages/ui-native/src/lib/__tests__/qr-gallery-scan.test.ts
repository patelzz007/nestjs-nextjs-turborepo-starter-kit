import type { BarcodeScanningResult } from "expo-camera";
import type { ImagePickerResult } from "expo-image-picker";

import { firstQrData, scanQrFromGallery, type GalleryScanDevice } from "../qr-gallery-scan";

jest.mock("expo-camera", () => ({ scanFromURLAsync: jest.fn(), CameraView: {} }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

const PHOTO = "file:///photos/receipt.jpg";

function barcode(data: string): BarcodeScanningResult {
	return { type: "qr", data, raw: data, cornerPoints: [], bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } };
}

function picked(uri: string): ImagePickerResult {
	return {
		canceled: false,
		assets: [{ uri, width: 1, height: 1, type: "image", fileName: null, fileSize: 1, mimeType: "image/jpeg", assetId: null, base64: null, exif: null, duration: null }],
	};
}

function device(pick: ImagePickerResult, decoded: readonly BarcodeScanningResult[] | Error): GalleryScanDevice & { readonly decode: jest.Mock } {
	return {
		pickImage: (): Promise<ImagePickerResult> => Promise.resolve(pick),
		decode: jest.fn((): Promise<readonly BarcodeScanningResult[]> => (decoded instanceof Error ? Promise.reject(decoded) : Promise.resolve(decoded))),
	};
}

describe("scanQrFromGallery", () => {
	it("reads the code in the photo picked", async () => {
		const phone = device(picked(PHOTO), [barcode("pos-pair:v1:ABCD")]);

		await expect(scanQrFromGallery(phone)).resolves.toEqual({ kind: "scanned", data: "pos-pair:v1:ABCD" });
		expect(phone.decode).toHaveBeenCalledWith(PHOTO);
	});

	it("is cancelled when no photo is picked", async () => {
		await expect(scanQrFromGallery(device({ canceled: true, assets: null }, []))).resolves.toEqual({ kind: "cancelled" });
	});

	it("says so when the photo holds no code", async () => {
		await expect(scanQrFromGallery(device(picked(PHOTO), []))).resolves.toEqual({ kind: "no-code" });
	});

	it("never throws when the photo cannot be decoded", async () => {
		await expect(scanQrFromGallery(device(picked(PHOTO), new Error("decode failed")))).resolves.toEqual({ kind: "failed" });
	});
});

describe("firstQrData", () => {
	it("skips empty reads", () => {
		expect(firstQrData([barcode(""), barcode("second")])).toBe("second");
		expect(firstQrData([])).toBeNull();
	});
});
