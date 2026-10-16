// The expo-camera boundary under Jest: the camera, Google's code scanner and
// the permission are native, so suites that render `QrScanner` mock
// "expo-camera" with this module (`jest.mock("expo-camera", () => mockExpoCamera)`).
// The camera renders as a plain View carrying its props, so a test reads a
// code by calling its `onBarcodeScanned`; the permission is whatever the suite
// puts in `cameraPermission.current`.

import type { BarcodeScanningResult, CameraViewProps, PermissionResponse, ScanningOptions, ScanningResult } from "expo-camera";
import { PermissionStatus } from "expo";
import * as React from "react";
import { View } from "react-native";

/** An `EventSubscription` stand-in. */
export interface MockSubscription {
	readonly remove: jest.Mock<void, []>;
}

type ScanListener = (result: ScanningResult) => void;

/** The listeners `onModernBarcodeScanned` holds, so a suite can deliver a code from "Google's scanner". */
export const modernScanListeners = new Set<ScanListener>();

type MockCameraViewProps = CameraViewProps & { readonly className?: string | undefined };

/** The props the camera was last rendered with (`null` before it first renders), so a suite can fire its events. */
export const latestCameraProps: { current: MockCameraViewProps | null } = { current: null };

export class CameraView extends React.Component<MockCameraViewProps> {
	public static isModernBarcodeScannerAvailable = false;

	public static launchScanner: jest.Mock<Promise<void>, [ScanningOptions?]> = jest.fn<Promise<void>, [ScanningOptions?]>((): Promise<void> => Promise.resolve());

	public static onModernBarcodeScanned: jest.Mock<MockSubscription, [ScanListener]> = jest.fn<MockSubscription, [ScanListener]>((listener: ScanListener): MockSubscription => {
		modernScanListeners.add(listener);
		return { remove: jest.fn((): void => void modernScanListeners.delete(listener)) };
	});

	public override render(): React.JSX.Element {
		latestCameraProps.current = this.props;
		return <View {...this.props} />;
	}
}

/** Delivers `data` to every Google-scanner listener, as the native event does. */
export function emitModernScan(data: string): void {
	for (const listener of modernScanListeners) {
		listener({ type: "qr", data });
	}
}

/** The permission `useCameraPermissions` reports (`null`: still being read). */
export const cameraPermission: { current: PermissionResponse | null } = { current: null };

export const requestCameraPermission: jest.Mock<Promise<PermissionResponse>, []> = jest.fn<Promise<PermissionResponse>, []>((): Promise<PermissionResponse> => {
	const current = cameraPermission.current;
	return current === null ? Promise.reject(new Error("Set cameraPermission.current before the scanner asks for it.")) : Promise.resolve(current);
});

export function useCameraPermissions(): [PermissionResponse | null, () => Promise<PermissionResponse>, () => Promise<PermissionResponse>] {
	return [cameraPermission.current, requestCameraPermission, requestCameraPermission];
}

/** A granted / refusable / blocked permission, as the native module reports it. */
export function permissionOf(granted: boolean, canAskAgain: boolean): PermissionResponse {
	return { granted, canAskAgain, expires: "never", status: granted ? PermissionStatus.GRANTED : canAskAgain ? PermissionStatus.UNDETERMINED : PermissionStatus.DENIED };
}

/** A read code as the camera reports it. */
export function scannedBarcode(data: string): BarcodeScanningResult {
	return { type: "qr", data, cornerPoints: [], bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } };
}
