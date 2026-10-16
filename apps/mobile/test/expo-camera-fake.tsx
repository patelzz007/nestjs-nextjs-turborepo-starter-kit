// expo-camera under Jest (jest.setup.ts mocks "expo-camera" with this module):
// the camera, Google's code scanner and the camera permission are the OS's.
// Jest runs as iOS, so `QrScanner` shows the kit's camera scanner; a test reads
// a code with `readQrCode` (the camera's barcode event) and decides the
// permission with `setCameraPermission`. The camera is granted unless a test
// says otherwise. Reset before every test.

import type { BarcodeScanningResult, CameraViewProps, PermissionResponse, ScanningOptions, ScanningResult } from "expo-camera";
import { PermissionStatus } from "expo";
import * as React from "react";
import { View } from "react-native";

type FakeCameraViewProps = CameraViewProps & { readonly className?: string | undefined };

/** The props the camera was last rendered with (`null`: not on screen since the last reset). */
let latestProps: FakeCameraViewProps | null = null;

export class CameraView extends React.Component<FakeCameraViewProps> {
	public static isModernBarcodeScannerAvailable = false;

	public static launchScanner(_options?: ScanningOptions): Promise<void> {
		return Promise.reject(new Error("Google's code scanner does not run under Jest (iOS): the kit's camera scanner is used."));
	}

	public static onModernBarcodeScanned(_listener: (result: ScanningResult) => void): { readonly remove: () => void } {
		return { remove: (): void => undefined };
	}

	public override render(): React.JSX.Element {
		latestProps = this.props;
		return <View {...this.props} />;
	}
}

function permissionOf(granted: boolean, canAskAgain: boolean): PermissionResponse {
	return { granted, canAskAgain, expires: "never", status: granted ? PermissionStatus.GRANTED : canAskAgain ? PermissionStatus.UNDETERMINED : PermissionStatus.DENIED };
}

let permission: PermissionResponse = permissionOf(true, true);
let requests = 0;

function requestPermission(): Promise<PermissionResponse> {
	requests += 1;
	return Promise.resolve(permission);
}

export function useCameraPermissions(): [PermissionResponse | null, () => Promise<PermissionResponse>, () => Promise<PermissionResponse>] {
	return [permission, requestPermission, requestPermission];
}

/** `granted`, or refused (`canAskAgain`: the OS may still ask). */
export function setCameraPermission(granted: boolean, canAskAgain: boolean): void {
	permission = permissionOf(granted, canAskAgain);
}

/** How many times the app asked for the camera since the last reset. */
export function cameraPermissionRequests(): number {
	return requests;
}

/** Whether the camera is on screen and reading codes. */
export function isReadingQrCodes(): boolean {
	return latestProps?.onBarcodeScanned !== undefined;
}

/** The camera reads `data`, as its native barcode event would. */
export function readQrCode(data: string): void {
	const onBarcodeScanned = latestProps?.onBarcodeScanned;
	if (onBarcodeScanned === undefined) {
		throw new Error("The camera is not on screen reading codes — open the scanner first.");
	}
	const result: BarcodeScanningResult = { type: "qr", data, cornerPoints: [], bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } };
	onBarcodeScanned(result);
}

export function reset(): void {
	latestProps = null;
	permission = permissionOf(true, true);
	requests = 0;
}
