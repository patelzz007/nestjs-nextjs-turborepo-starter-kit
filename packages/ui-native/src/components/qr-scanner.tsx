// A full-screen QR code scanner. Controlled: the caller owns `visible`, gets
// the decoded text from `onScan` and is told when the person backs out
// (`onClose`); it reads every code, so the caller decides what the text means.
//
// In an Android build with Google Play services it opens Google's own code
// scanner (ML Kit — the scanner Google ships; no camera permission: Play
// services owns the camera). Everywhere else (iOS, an Android phone without
// Play services, Expo Go — see lib/qr-scanner-engine.ts — or when Google's
// scanner cannot start) it shows the kit's own
// scanner in the same spirit: the live camera (expo-camera's CameraView —
// ML Kit on Android, AVFoundation on iOS) behind a dimmed frame with a
// bracketed viewfinder, a close button, a torch toggle and one line of
// guidance. The camera permission is asked the moment the scanner opens,
// with what it is for; a refusal is a designed state with a way to Settings.
//
// One code per opening: after a read the camera stops reporting until the
// scanner is opened again, so a code held in view is never delivered twice.

import { cva, type VariantProps } from "class-variance-authority";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeSettings } from "expo-camera";
import FlashlightIcon from "lucide-react-native/icons/flashlight";
import FlashlightOffIcon from "lucide-react-native/icons/flashlight-off";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Linking, Modal, Platform, Pressable, Text, View, type ViewInstance, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { launchGoogleScanner, QR_BARCODE_TYPES, resolveQrScannerEngine, type GoogleScanOutcome, type QrScannerEngine } from "../lib/qr-scanner-engine";
import { Button } from "./button";
import { Icon } from "./icon";

/** The camera scanner's full-screen surface: the scrim behind the live camera. One look; `variant` keeps the kit's shape. */
export const qrScannerVariants = cva("flex-1 bg-scrim", {
	variants: { variant: { default: "" } },
	defaultVariants: { variant: "default" },
});

export type QrScannerVariant = NonNullable<VariantProps<typeof qrScannerVariants>["variant"]>;

/** What the camera looks for: QR codes only. */
const QR_SCANNER_SETTINGS: BarcodeSettings = { barcodeTypes: [...QR_BARCODE_TYPES] };

/** CameraView with Uniwind's `className` (a third-party component ignores it otherwise). */
const ThemedCameraView = withUniwind(CameraView);

/** Every word the scanner shows; the caller may replace any of them (e.g. to translate). */
export interface QrScannerLabels {
	/** The heading over the camera. */
	readonly title: string;
	/** The guidance under the viewfinder. */
	readonly hint: string;
	readonly close: string;
	readonly torchOn: string;
	readonly torchOff: string;
	/** Why the camera is needed, shown before (and after a refusal of) the permission. */
	readonly permissionTitle: string;
	readonly permissionDescription: string;
	readonly allowCamera: string;
	/** The permission was refused for good: only Settings can turn it back on. */
	readonly permissionBlockedDescription: string;
	readonly openSettings: string;
}

export const DEFAULT_QR_SCANNER_LABELS: QrScannerLabels = {
	title: "Scan QR code",
	hint: "Point your camera at a QR code",
	close: "Close scanner",
	torchOn: "Turn on flashlight",
	torchOff: "Turn off flashlight",
	permissionTitle: "Allow camera access",
	permissionDescription: "The camera is used only while this scanner is open, to read the QR code in front of it.",
	allowCamera: "Allow camera",
	permissionBlockedDescription: "Camera access is turned off for this app. Turn it on in Settings to scan QR codes.",
	openSettings: "Open Settings",
};

export interface QrScannerProps {
	readonly visible: boolean;
	/** The decoded text of the code that was read. */
	readonly onScan: (data: string) => void;
	/** The person closed the scanner without reading a code. */
	readonly onClose: () => void;
	readonly labels?: Partial<QrScannerLabels> | undefined;
	/** Which scanner to use; by default Google's where Android has it (see `resolveQrScannerEngine`). */
	readonly engine?: QrScannerEngine | undefined;
	readonly variant?: QrScannerVariant | undefined;
	readonly testID?: string | undefined;
}

/** This device's scanner, decided once: whether Play services is present does not change while the app runs. */
function deviceEngine(): QrScannerEngine {
	return resolveQrScannerEngine({
		platform: Platform.OS,
		isModernScannerAvailable: CameraView.isModernBarcodeScannerAvailable,
		isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
	});
}

/** The ref reaches the camera scanner's surface while it is open (Google's scanner draws nothing of ours). */
export const QrScanner = React.memo(
	React.forwardRef<ViewInstance, QrScannerProps>(function QrScanner({ visible, onScan, onClose, labels, engine, variant = "default", testID }, ref): React.JSX.Element | null {
		const text = React.useMemo((): QrScannerLabels => ({ ...DEFAULT_QR_SCANNER_LABELS, ...labels }), [labels]);
		const [preferredEngine] = React.useState((): QrScannerEngine => engine ?? deviceEngine());
		/** Google's scanner could not start on this device: the camera scanner stands in for the rest of the app's life. */
		const [isGoogleUnavailable, setGoogleUnavailable] = React.useState(false);
		const activeEngine: QrScannerEngine = preferredEngine === "google" && !isGoogleUnavailable ? "google" : "camera";

		const onScanRef = React.useRef(onScan);
		const onCloseRef = React.useRef(onClose);
		React.useEffect((): void => {
			onScanRef.current = onScan;
			onCloseRef.current = onClose;
		}, [onScan, onClose]);

		React.useEffect((): void => {
			if (!visible || activeEngine !== "google") {
				return;
			}
			void launchGoogleScanner().then((outcome: GoogleScanOutcome): void => {
				switch (outcome.kind) {
					case "scanned":
						onScanRef.current(outcome.data);
						return;
					case "cancelled":
						onCloseRef.current();
						return;
					case "unavailable":
						setGoogleUnavailable(true);
						return;
				}
			});
		}, [visible, activeEngine]);

		if (activeEngine === "google") {
			return null;
		}
		return <CameraScanner ref={ref} visible={visible} onScan={onScan} onClose={onClose} labels={text} variant={variant} testID={testID} />;
	}),
);

interface CameraScannerProps {
	readonly visible: boolean;
	readonly onScan: (data: string) => void;
	readonly onClose: () => void;
	readonly labels: QrScannerLabels;
	readonly variant: QrScannerVariant;
	readonly testID: string | undefined;
}

/**
 * The kit's own scanner: a full-screen modal over the live camera. Its surface
 * is mounted only while it is open, so each opening starts fresh — one code to
 * read, the torch off, the permission asked again if still undecided.
 */
const CameraScanner = React.forwardRef<ViewInstance, CameraScannerProps>(function CameraScanner(
	{ visible, onScan, onClose, labels, variant, testID },
	ref,
): React.JSX.Element {
	return (
		<Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
			{visible ? <CameraScannerSurface ref={ref} onScan={onScan} onClose={onClose} labels={labels} variant={variant} testID={testID} /> : null}
		</Modal>
	);
});

type CameraScannerSurfaceProps = Omit<CameraScannerProps, "visible">;

const CameraScannerSurface = React.forwardRef<ViewInstance, CameraScannerSurfaceProps>(function CameraScannerSurface(
	{ onScan, onClose, labels, variant, testID },
	ref,
): React.JSX.Element {
	const [permission, requestPermission] = useCameraPermissions();
	const [isTorchOn, setTorchOn] = React.useState(false);
	const [hasRead, setHasRead] = React.useState(false);
	const insets = useSafeAreaInsets();
	const barsStyle = React.useMemo((): ViewStyle => ({ paddingTop: insets.top, paddingBottom: insets.bottom }), [insets.top, insets.bottom]);

	// Ask the moment the scanner opens — never earlier (rules/04, permissions).
	const isUndecided = permission !== null && !permission.granted && permission.canAskAgain;
	const hasAsked = React.useRef(false);
	React.useEffect((): void => {
		if (isUndecided && !hasAsked.current) {
			hasAsked.current = true;
			void requestPermission();
		}
	}, [isUndecided, requestPermission]);

	const handleBarcode = React.useCallback(
		(result: BarcodeScanningResult): void => {
			setHasRead(true);
			onScan(result.data);
		},
		[onScan],
	);
	const toggleTorch = React.useCallback((): void => {
		setTorchOn((current: boolean): boolean => !current);
	}, []);
	const askAgain = React.useCallback((): void => {
		void requestPermission();
	}, [requestPermission]);
	const openSettings = React.useCallback((): void => {
		void Linking.openSettings();
	}, []);

	const isGranted = permission?.granted === true;
	return (
		<View ref={ref} testID={testID} className={qrScannerVariants({ variant })}>
			{isGranted ? (
				<ThemedCameraView
					className="absolute inset-0"
					facing="back"
					enableTorch={isTorchOn}
					barcodeScannerSettings={QR_SCANNER_SETTINGS}
					{...(hasRead ? {} : { onBarcodeScanned: handleBarcode })}
					testID={testID === undefined ? undefined : `${testID}-camera`}
				/>
			) : null}
			{isGranted ? <Viewfinder hint={labels.hint} /> : null}
			<View className="absolute inset-0" style={barsStyle} pointerEvents="box-none">
				<View className="flex-row items-center justify-between px-4 py-2">
					<OverlayButton icon={XIcon} label={labels.close} onPress={onClose} />
					<Text accessibilityRole="header" className="font-sans-semibold text-lg text-scrim-foreground">
						{labels.title}
					</Text>
					{isGranted ? (
						<OverlayButton icon={isTorchOn ? FlashlightOffIcon : FlashlightIcon} label={isTorchOn ? labels.torchOff : labels.torchOn} onPress={toggleTorch} />
					) : (
						<View className="size-11" />
					)}
				</View>
				{isGranted ? null : (
					<PermissionPanel
						permissionKnown={permission !== null}
						canAskAgain={permission?.canAskAgain ?? true}
						labels={labels}
						onAllow={askAgain}
						onOpenSettings={openSettings}
					/>
				)}
			</View>
		</View>
	);
});

/** The dimmed frame around a clear square in the middle of the screen, its corners bracketed, the guidance below. */
function Viewfinder({ hint }: { readonly hint: string }): React.JSX.Element {
	return (
		<View className="absolute inset-0" pointerEvents="none">
			<View className="flex-1 bg-scrim opacity-60" />
			<View className="flex-row">
				<View className="flex-1 bg-scrim opacity-60" />
				<View className="size-64">
					<View className="absolute top-0 left-0 size-10 rounded-tl-3xl border-t-4 border-l-4 border-scrim-foreground" />
					<View className="absolute top-0 right-0 size-10 rounded-tr-3xl border-t-4 border-r-4 border-scrim-foreground" />
					<View className="absolute bottom-0 left-0 size-10 rounded-bl-3xl border-b-4 border-l-4 border-scrim-foreground" />
					<View className="absolute right-0 bottom-0 size-10 rounded-br-3xl border-r-4 border-b-4 border-scrim-foreground" />
				</View>
				<View className="flex-1 bg-scrim opacity-60" />
			</View>
			<View className="flex-1">
				<View className="absolute inset-0 bg-scrim opacity-60" />
				<Text className="font-sans-medium mt-8 px-8 text-center text-base text-scrim-foreground">{hint}</Text>
			</View>
		</View>
	);
}

interface PermissionPanelProps {
	/** `false` while the permission is still being read. */
	readonly permissionKnown: boolean;
	readonly canAskAgain: boolean;
	readonly labels: QrScannerLabels;
	readonly onAllow: () => void;
	readonly onOpenSettings: () => void;
}

function PermissionPanel({ permissionKnown, canAskAgain, labels, onAllow, onOpenSettings }: PermissionPanelProps): React.JSX.Element | null {
	if (!permissionKnown) {
		return null;
	}
	return (
		<View className="flex-1 items-center justify-center gap-4 px-8">
			<Text accessibilityRole="header" className="text-center font-heading text-2xl text-scrim-foreground">
				{labels.permissionTitle}
			</Text>
			<Text className="text-center font-sans text-base text-scrim-foreground">{canAskAgain ? labels.permissionDescription : labels.permissionBlockedDescription}</Text>
			{canAskAgain ? <Button label={labels.allowCamera} onPress={onAllow} /> : <Button label={labels.openSettings} onPress={onOpenSettings} />}
		</View>
	);
}

interface OverlayButtonProps {
	readonly icon: React.ComponentProps<typeof Icon>["icon"];
	readonly label: string;
	readonly onPress: () => void;
}

/** A round 44 pt control over the camera: a light glyph on a dim disc, legible on any scene. */
function OverlayButton({ icon, label, onPress }: OverlayButtonProps): React.JSX.Element {
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="size-11 items-center justify-center rounded-full active:opacity-80">
			<View className="absolute inset-0 rounded-full bg-scrim opacity-40" />
			<Icon icon={icon} size="md" colorClassName="accent-scrim-foreground" />
		</Pressable>
	);
}
