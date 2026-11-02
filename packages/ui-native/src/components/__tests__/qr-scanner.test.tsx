import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { Linking, type ViewInstance } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import * as mockExpoCamera from "../../../test/expo-camera-mock";
import { SCANNER_SHEET_MOTION } from "../../lib/motion";
import type { GalleryScanDevice } from "../../lib/qr-gallery-scan";
import { LOCK_HOLD_MS, SLOW_SCAN_AFTER_MS } from "../../lib/qr-viewfinder";
import { DEFAULT_QR_SCANNER_LABELS, deviceQrScannerEngine, galleryScanMessage, QrScanFromGalleryButton, QrScanner } from "../qr-scanner";

jest.mock("expo-camera", () => mockExpoCamera);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

/** A photo library whose one photo holds `data` (or no code at all). */
function libraryWith(data: string | null): GalleryScanDevice {
	return {
		pickImage: () =>
			Promise.resolve({
				canceled: false,
				assets: [
					{
						uri: "file:///photo.jpg",
						width: 1,
						height: 1,
						type: "image",
						fileName: null,
						fileSize: 1,
						mimeType: "image/jpeg",
						assetId: null,
						base64: null,
						exif: null,
						duration: null,
					},
				],
			}),
		decode: () => Promise.resolve(data === null ? [] : [mockExpoCamera.scannedBarcode(data)]),
	};
}

const { CameraView, cameraPermission, cameraStart, emitModernScan, latestCameraProps, modernScanListeners, permissionOf, requestCameraPermission, scannedBarcode } =
	mockExpoCamera;

const SCANNER = "scanner";
const CAMERA = `${SCANNER}-camera`;
const CODE = "pos-pair:v1:ABCD2345";
const SCAN_LINE = "qr-scanner-scan-line";

/** A phone with a notch and a home indicator: the scanner's bars sit inside them. */
const PHONE_METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } };

function onPhone(scanner: React.JSX.Element): React.JSX.Element {
	return <SafeAreaProvider initialMetrics={PHONE_METRICS}>{scanner}</SafeAreaProvider>;
}

interface Handlers {
	readonly onScan: jest.Mock<undefined, [string]>;
	readonly onClose: jest.Mock<undefined, []>;
}

function handlers(): Handlers {
	return { onScan: jest.fn<undefined, [string]>(), onClose: jest.fn<undefined, []>() };
}

/** Reads `data` with the in-app camera, as its native barcode event would. */
async function readWithCamera(data: string): Promise<void> {
	const onBarcodeScanned = latestCameraProps.current?.onBarcodeScanned;
	if (onBarcodeScanned === undefined) {
		throw new Error("The camera is not reading codes.");
	}
	await act((): void => {
		onBarcodeScanned(scannedBarcode(data));
	});
}

afterEach(() => {
	cameraPermission.current = null;
	cameraStart.current = "ready";
	latestCameraProps.current = null;
	modernScanListeners.clear();
});

describe("QrScanner — the kit's camera scanner", () => {
	it("shows the live camera, QR codes only, inside the viewfinder with its guidance", async () => {
		cameraPermission.current = permissionOf(true, true);
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));

		expect(screen.getByTestId(CAMERA)).toHaveProp("barcodeScannerSettings", { barcodeTypes: ["qr"] });
		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.title)).toBeOnTheScreen();
		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.hint)).toBeOnTheScreen();
	});

	it("says it is starting the camera, and reads no code until the camera is ready", async () => {
		cameraPermission.current = permissionOf(true, true);
		cameraStart.current = "pending";
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));

		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.startingCamera)).toBeOnTheScreen();
		expect(latestCameraProps.current?.onBarcodeScanned).toBeUndefined();

		await act((): void => {
			latestCameraProps.current?.onCameraReady?.();
		});

		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.hint)).toBeOnTheScreen();
		expect(latestCameraProps.current?.onBarcodeScanned).toBeDefined();
	});

	it("offers a tip when no code was read for a while", async () => {
		jest.useFakeTimers();
		try {
			cameraPermission.current = permissionOf(true, true);
			await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));

			await act((): void => {
				jest.advanceTimersByTime(SLOW_SCAN_AFTER_MS);
			});

			expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.slowHint)).toBeOnTheScreen();
			expect(latestCameraProps.current?.onBarcodeScanned).toBeDefined();
		} finally {
			jest.useRealTimers();
		}
	});

	it("explains a camera that could not start, and still offers a photo", async () => {
		cameraPermission.current = permissionOf(true, true);
		cameraStart.current = "fails";
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} galleryDevice={libraryWith(CODE)} testID={SCANNER} />));

		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.cameraFailed)).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.torchOn })).toBeNull();
		expect(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.scanFromGallery })).toBeOnTheScreen();
	});

	it("locks onto the first code read — says it was found, taps the phone — then delivers it once and stops reading", async () => {
		cameraPermission.current = permissionOf(true, true);
		const success = jest.spyOn(Haptics, "notificationAsync").mockResolvedValue(undefined);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		await readWithCamera(CODE);

		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.found)).toBeOnTheScreen();
		expect(success).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
		expect(latestCameraProps.current?.onBarcodeScanned).toBeUndefined();
		await waitFor((): void => {
			expect(onScan).toHaveBeenCalledWith(CODE);
		});
		expect(onScan).toHaveBeenCalledTimes(1);
	});

	it("hands nothing over when it is closed during the lock", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await readWithCamera(CODE);

		await screen.rerender(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await act(async (): Promise<void> => {
			await new Promise((resolve): void => {
				setTimeout(resolve, 600);
			});
		});

		expect(onScan).not.toHaveBeenCalled();
	});

	it("reads again after being closed and reopened", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await readWithCamera(CODE);
		await waitFor((): void => {
			expect(onScan).toHaveBeenCalledWith(CODE);
		});

		await screen.rerender(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await screen.rerender(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await readWithCamera("second-code");

		await waitFor((): void => {
			expect(onScan).toHaveBeenLastCalledWith("second-code");
		});
	});

	it("slides the camera and everything over it away as one sheet, reading nothing while it leaves", async () => {
		jest.useFakeTimers();
		try {
			cameraPermission.current = permissionOf(true, true);
			const { onScan, onClose } = handlers();
			await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
			await act((): void => {
				jest.advanceTimersByTime(SCANNER_SHEET_MOTION.enter.duration);
			});

			await screen.rerender(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
			await act((): void => {
				jest.advanceTimersByTime(SCANNER_SHEET_MOTION.exit.duration - 1);
			});
			expect(screen.getByTestId(CAMERA)).toBeOnTheScreen();
			expect(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.close })).toBeOnTheScreen();
			expect(latestCameraProps.current?.onBarcodeScanned).toBeUndefined();

			await act((): void => {
				jest.advanceTimersByTime(SCANNER_SHEET_MOTION.exit.duration);
			});
			expect(screen.queryByTestId(CAMERA)).toBeNull();
			expect(screen.queryByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.close })).toBeNull();
			expect(onScan).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});

	it("stays open when it is opened before its last slide away was reported finished", async () => {
		jest.useFakeTimers();
		try {
			cameraPermission.current = permissionOf(true, true);
			const { onScan, onClose } = handlers();
			await render(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
			await screen.rerender(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
			await act((): void => {
				jest.advanceTimersByTime(SCANNER_SHEET_MOTION.enter.duration);
			});

			expect(screen.getByTestId(CAMERA)).toBeOnTheScreen();
			await readWithCamera(CODE);
			await act((): void => {
				jest.advanceTimersByTime(LOCK_HOLD_MS);
			});
			expect(onScan).toHaveBeenCalledWith(CODE);
		} finally {
			jest.useRealTimers();
		}
	});

	it("sweeps a scan line across the window while it looks, never before the camera is ready", async () => {
		cameraPermission.current = permissionOf(true, true);
		cameraStart.current = "pending";
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));
		expect(screen.queryByTestId(SCAN_LINE, { includeHiddenElements: true })).toBeNull();

		await act((): void => {
			latestCameraProps.current?.onCameraReady?.();
		});

		expect(screen.getByTestId(SCAN_LINE, { includeHiddenElements: true })).toBeTruthy();
		expect(screen.queryByTestId(SCAN_LINE)).toBeNull();
	});

	it("closes from its close button", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.close }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onScan).not.toHaveBeenCalled();
	});

	it("turns the flashlight on and off", async () => {
		cameraPermission.current = permissionOf(true, true);
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.torchOn }));
		expect(screen.getByTestId(CAMERA)).toHaveProp("enableTorch", true);

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.torchOff }));
		expect(screen.getByTestId(CAMERA)).toHaveProp("enableTorch", false);
	});

	it("asks for the camera the moment it opens — never while hidden", async () => {
		cameraPermission.current = permissionOf(false, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		expect(requestCameraPermission).not.toHaveBeenCalled();

		await screen.rerender(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		expect(requestCameraPermission).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId(CAMERA)).toBeNull();
		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.permissionDescription)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.allowCamera }));
		expect(requestCameraPermission).toHaveBeenCalledTimes(2);
	});

	it("after a refusal for good, explains it and offers Settings", async () => {
		cameraPermission.current = permissionOf(false, false);
		const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} testID={SCANNER} />));

		expect(requestCameraPermission).not.toHaveBeenCalled();
		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.permissionBlockedDescription)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.openSettings }));
		expect(openSettings).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref to the scanner's surface while open", async () => {
		cameraPermission.current = permissionOf(true, true);
		const ref = React.createRef<ViewInstance>();
		await render(onPhone(<QrScanner ref={ref} visible engine="camera" {...handlers()} testID={SCANNER} />));

		expect(ref.current).not.toBeNull();
	});

	it("takes the caller's words in place of the defaults", async () => {
		cameraPermission.current = permissionOf(true, true);
		await render(onPhone(<QrScanner visible engine="camera" {...handlers()} labels={{ title: "Scan the customer's code" }} testID={SCANNER} />));

		expect(screen.getByText("Scan the customer's code")).toBeOnTheScreen();
		expect(screen.getByText(DEFAULT_QR_SCANNER_LABELS.hint)).toBeOnTheScreen();
	});
});

describe("QrScanner — Google's code scanner", () => {
	it("is not this device's scanner off Android or without Play services: a screen offering both disables it", () => {
		expect(deviceQrScannerEngine()).toBe("camera");
	});

	it("opens Google's scanner when shown and delivers its code, drawing nothing itself", async () => {
		CameraView.launchScanner.mockImplementationOnce((): Promise<void> => {
			emitModernScan(CODE);
			return Promise.resolve();
		});
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="google" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		expect(onScan).toHaveBeenCalledWith(CODE);
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.queryByTestId(SCANNER)).toBeNull();
	});

	it("reports a close when the person backs out of Google's scanner", async () => {
		CameraView.launchScanner.mockResolvedValueOnce(undefined);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="google" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onScan).not.toHaveBeenCalled();
	});

	it("does not open Google's scanner while hidden", async () => {
		await render(onPhone(<QrScanner visible={false} engine="google" {...handlers()} testID={SCANNER} />));

		expect(CameraView.launchScanner).not.toHaveBeenCalled();
	});

	it("falls back to the camera scanner when Google's cannot start", async () => {
		cameraPermission.current = permissionOf(true, true);
		CameraView.launchScanner.mockRejectedValueOnce(Object.assign(new Error("no Play services"), { code: "ERR_GOOGLE_PLAY_SERVICES_UNAVAILABLE" }));
		await render(onPhone(<QrScanner visible engine="google" {...handlers()} testID={SCANNER} />));

		expect(await screen.findByTestId(CAMERA)).toBeOnTheScreen();
	});

	it("tries Google's scanner again on the next opening after it could not open (Play services may have been updating)", async () => {
		cameraPermission.current = permissionOf(true, true);
		CameraView.launchScanner.mockRejectedValueOnce(Object.assign(new Error("Play services unavailable"), { code: "ERR_GOOGLE_PLAY_SERVICES_UNAVAILABLE" }));
		const view = await render(onPhone(<QrScanner visible engine="google" {...handlers()} testID={SCANNER} />));
		expect(await screen.findByTestId(CAMERA)).toBeOnTheScreen();

		CameraView.launchScanner.mockImplementationOnce((): Promise<void> => {
			emitModernScan(CODE);
			return Promise.resolve();
		});
		const { onScan, onClose } = handlers();
		await view.rerender(onPhone(<QrScanner visible={false} engine="google" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await view.rerender(onPhone(<QrScanner visible engine="google" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		expect(CameraView.launchScanner).toHaveBeenCalledTimes(2);
		expect(onScan).toHaveBeenCalledWith(CODE);
		expect(screen.queryByTestId(CAMERA)).toBeNull();
	});

	it("closes, without falling back, when the person leaves Google's scanner with the back button (a scan failure to expo-camera)", async () => {
		cameraPermission.current = permissionOf(true, true);
		CameraView.launchScanner.mockRejectedValueOnce(Object.assign(new Error("Barcode scanning failed"), { code: "ERR_BARCODE_SCANNING_FAILED" }));
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="google" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onScan).not.toHaveBeenCalled();
		expect(screen.queryByTestId(CAMERA)).toBeNull();
	});
});

describe("QrScanner — scan from gallery", () => {
	it("reads a code from a photo in the camera scanner, and stops the camera", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} galleryDevice={libraryWith(CODE)} testID={SCANNER} />));

		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.scanFromGallery }));
		});

		expect(onScan).toHaveBeenCalledWith(CODE);
		expect(latestCameraProps.current?.onBarcodeScanned).toBeUndefined();
	});

	it("says when the photo holds no code, and keeps the camera reading", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} galleryDevice={libraryWith(null)} testID={SCANNER} />));

		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.scanFromGallery }));
		});

		expect(await screen.findByText(DEFAULT_QR_SCANNER_LABELS.galleryNoCode)).toBeOnTheScreen();
		expect(onScan).not.toHaveBeenCalled();
		expect(latestCameraProps.current?.onBarcodeScanned).toBeDefined();
	});

	it("can leave the gallery out", async () => {
		cameraPermission.current = permissionOf(true, true);
		await render(onPhone(<QrScanner visible engine="camera" allowGallery={false} {...handlers()} testID={SCANNER} />));

		expect(screen.queryByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.scanFromGallery })).toBeNull();
	});

	it("offers the same beside Google's scanner, which draws its own screen", async () => {
		const onScan = jest.fn<undefined, [string]>();
		await render(<QrScanFromGalleryButton onScan={onScan} galleryDevice={libraryWith(CODE)} />);

		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: DEFAULT_QR_SCANNER_LABELS.scanFromGallery }));
		});

		expect(onScan).toHaveBeenCalledWith(CODE);
	});

	it("words only the outcomes that need it", () => {
		expect(galleryScanMessage({ kind: "failed" }, DEFAULT_QR_SCANNER_LABELS)).toBe(DEFAULT_QR_SCANNER_LABELS.galleryFailed);
		expect(galleryScanMessage({ kind: "cancelled" }, DEFAULT_QR_SCANNER_LABELS)).toBeNull();
		expect(galleryScanMessage({ kind: "scanned", data: CODE }, DEFAULT_QR_SCANNER_LABELS)).toBeNull();
	});
});
