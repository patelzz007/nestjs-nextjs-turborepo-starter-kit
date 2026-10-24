import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Linking, type ViewInstance } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import * as mockExpoCamera from "../../../test/expo-camera-mock";
import { DEFAULT_QR_SCANNER_LABELS, QrScanner } from "../qr-scanner";

jest.mock("expo-camera", () => mockExpoCamera);

const { CameraView, cameraPermission, emitModernScan, latestCameraProps, modernScanListeners, permissionOf, requestCameraPermission, scannedBarcode } = mockExpoCamera;

const SCANNER = "scanner";
const CAMERA = `${SCANNER}-camera`;
const CODE = "pos-pair:v1:ABCD2345";

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

	it("delivers the first code read, then stops reading until it is opened again", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));

		await readWithCamera(CODE);

		expect(onScan).toHaveBeenCalledWith(CODE);
		expect(latestCameraProps.current?.onBarcodeScanned).toBeUndefined();
	});

	it("reads again after being closed and reopened", async () => {
		cameraPermission.current = permissionOf(true, true);
		const { onScan, onClose } = handlers();
		await render(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await readWithCamera(CODE);

		await screen.rerender(onPhone(<QrScanner visible={false} engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await screen.rerender(onPhone(<QrScanner visible engine="camera" onScan={onScan} onClose={onClose} testID={SCANNER} />));
		await readWithCamera("second-code");

		expect(onScan).toHaveBeenLastCalledWith("second-code");
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
});
