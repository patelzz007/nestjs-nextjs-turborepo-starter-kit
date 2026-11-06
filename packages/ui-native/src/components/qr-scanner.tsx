// A full-screen QR code scanner. Controlled: the caller owns `visible`, gets
// the decoded text from `onScan` and is told when the person backs out
// (`onClose`); it reads every code, so the caller decides what the text means.
//
// In an Android build with Google Play services it opens Google's own code
// scanner (ML Kit — the scanner Google ships; no camera permission: Play
// services owns the camera). Everywhere else (iOS, an Android phone without
// Play services, Expo Go — see lib/qr-scanner-engine.ts — or when Google's
// scanner cannot start this time) it shows the kit's own
// scanner in the same spirit: the live camera (expo-camera's CameraView —
// ML Kit on Android, AVFoundation on iOS) behind a scrim with a rounded window
// cut out of it (lib/qr-viewfinder.ts places it), corner brackets on the
// window, one status line under it, a close button, and a dock at thumb height
// with Gallery and Light.
//
//   ( × )          Scan QR code
//          ╭──              ──╮      while looking the brackets breathe and a
//          │ ━━━━━━━━━━━━━━━━ │      scan line sweeps down and back up;
//          │       ( ✓ )      │      on a read they close in, turn the success
//          ╰──              ──╯      colour, a check appears and the phone taps
//        ( Point your camera… )      the status line: starting · looking · a tip
//                                    after 8 s · found · the camera failed
//        ( ▣ )          ( ϟ )
//       Gallery         Light
//
// The read code is handed over LOCK_HOLD_MS after the lock, so the person sees
// it was read; Reduce Motion turns the breathing, the sweep and the lock's
// movement off. The camera and its overlay slide up and away as one sheet.
// The camera permission is asked the moment the scanner opens, with what it is
// for; a refusal is a designed state with a way to Settings, and the dock still
// reads a photo (that needs no camera). A camera that fails to start says so.
//
// One code per opening: after a read the camera stops reporting until the
// scanner is opened again, so a code held in view is never delivered twice.
//
// Closing Google's scanner closes this scanner. ML Kit reports the person
// leaving it as a scan failure (the back button always, the X on some
// versions), so expo-camera's failure code reads as a close
// (lib/qr-scanner-engine.ts). Only a scanner that could not open at all — Play
// services or ML Kit missing — falls back to the camera scanner, and only for
// that opening: Play services may be updating, so the next opening tries
// Google's scanner again.
//
// Both scanners read a code from a photo too (lib/qr-gallery-scan.ts): the camera
// scanner has a "Scan from gallery" button in its overlay, and — Google's scanner
// drawing its own screen — `QrScanFromGalleryButton` offers the same beside it.

import { cva, type VariantProps } from "class-variance-authority";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeSettings } from "expo-camera";
import CameraIcon from "lucide-react-native/icons/camera";
import CheckIcon from "lucide-react-native/icons/check";
import FlashlightIcon from "lucide-react-native/icons/flashlight";
import FlashlightOffIcon from "lucide-react-native/icons/flashlight-off";
import ImagesIcon from "lucide-react-native/icons/images";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Text, useWindowDimensions, View, type ViewInstance, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { playSuccessFeedback } from "../lib/haptics";
import { SCAN_LINE_MOTION, SCANNER_SHEET_MOTION } from "../lib/motion";
import { OVERLAY_SHOWN, useOverlayPresence } from "../lib/use-overlay-presence";
import { scanQrFromGallery, type GalleryScanDevice, type GalleryScanOutcome } from "../lib/qr-gallery-scan";
import { launchGoogleScanner, QR_BARCODE_TYPES, resolveQrScannerEngine, type GoogleScanOutcome, type QrScannerEngine } from "../lib/qr-scanner-engine";
import { LOCK_HOLD_MS, SLOW_SCAN_AFTER_MS, scanStatusOf, type ScanPhase, VIEWFINDER_RADIUS, viewfinderLayout, type ViewfinderLayout } from "../lib/qr-viewfinder";
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

const StyledAnimatedView = withUniwind(Animated.View);

/** Every word the scanner shows; the caller may replace any of them (e.g. to translate). */
export interface QrScannerLabels {
	/** The heading over the camera. */
	readonly title: string;
	/** The line under the window while it looks for a code. */
	readonly hint: string;
	/** …while the camera starts. */
	readonly startingCamera: string;
	/** …when no code was read for a while: a tip. */
	readonly slowHint: string;
	/** …once a code is read. */
	readonly found: string;
	/** …when the camera could not start (a photo can still be read). */
	readonly cameraFailed: string;
	/** The caption under the dock's gallery button. */
	readonly gallery: string;
	/** The caption under the dock's light button. */
	readonly light: string;
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
	/** Read a code from a photo instead of the camera. */
	readonly scanFromGallery: string;
	/** The photo picked holds no QR code. */
	readonly galleryNoCode: string;
	/** The photo could not be read at all. */
	readonly galleryFailed: string;
}

export const DEFAULT_QR_SCANNER_LABELS: QrScannerLabels = {
	title: "Scan QR code",
	hint: "Point your camera at a QR code",
	startingCamera: "Starting the camera…",
	slowHint: "Hold steady and move a little closer. In low light, turn on the light.",
	found: "QR code found",
	cameraFailed: "The camera couldn't start. Close the scanner and try again, or pick a photo.",
	gallery: "Gallery",
	light: "Light",
	close: "Close scanner",
	torchOn: "Turn on flashlight",
	torchOff: "Turn off flashlight",
	permissionTitle: "Allow camera access",
	permissionDescription: "The camera is used only while this scanner is open, to read the QR code in front of it.",
	allowCamera: "Allow camera",
	permissionBlockedDescription: "Camera access is turned off for this app. Turn it on in Settings to scan QR codes.",
	openSettings: "Open Settings",
	scanFromGallery: "Scan from gallery",
	galleryNoCode: "No QR code found in that photo. Try a sharper one, or scan with the camera.",
	galleryFailed: "That photo could not be read. Try another one.",
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
	/** Offer "Scan from gallery" in the camera scanner (default on). */
	readonly allowGallery?: boolean | undefined;
	/** The photo picker and decoder; the device's own by default (replaced in tests). */
	readonly galleryDevice?: GalleryScanDevice | undefined;
	readonly variant?: QrScannerVariant | undefined;
	readonly testID?: string | undefined;
}

/** What a gallery scan that read nothing tells the person, or null for a code or a cancelled pick. */
export function galleryScanMessage(outcome: GalleryScanOutcome, labels: Pick<QrScannerLabels, "galleryNoCode" | "galleryFailed">): string | null {
	switch (outcome.kind) {
		case "no-code":
			return labels.galleryNoCode;
		case "failed":
			return labels.galleryFailed;
		case "scanned":
		case "cancelled":
			return null;
	}
}

/**
 * Pick a photo and read its code, with what went wrong said in place. The hook both scanners share:
 * one read per press, ignored while a pick is still open.
 */
function useGalleryScan(
	onScan: (data: string) => void,
	labels: QrScannerLabels,
	device: GalleryScanDevice | undefined,
): { readonly scan: () => void; readonly busy: boolean; readonly message: string | null } {
	const [busy, setBusy] = React.useState(false);
	const [message, setMessage] = React.useState<string | null>(null);
	const onScanRef = React.useRef(onScan);
	React.useEffect((): void => {
		onScanRef.current = onScan;
	}, [onScan]);
	const scan = React.useCallback((): void => {
		if (busy) {
			return;
		}
		setBusy(true);
		setMessage(null);
		void scanQrFromGallery(device)
			.then((outcome: GalleryScanOutcome): void => {
				setMessage(galleryScanMessage(outcome, labels));
				if (outcome.kind === "scanned") {
					onScanRef.current(outcome.data);
				}
			})
			.finally((): void => {
				setBusy(false);
			});
	}, [busy, device, labels]);
	return { scan, busy, message };
}

export interface QrScanFromGalleryButtonProps {
	/** The decoded text of the code in the photo. */
	readonly onScan: (data: string) => void;
	readonly labels?: Partial<QrScannerLabels> | undefined;
	readonly galleryDevice?: GalleryScanDevice | undefined;
	readonly testID?: string | undefined;
}

/**
 * "Scan from gallery" on its own: place it beside the button that opens `QrScanner`. Google's scanner
 * (Android) has its own screen, so this is how a photo is read there; on the camera scanner the same
 * action also sits in the overlay.
 */
export const QrScanFromGalleryButton = React.memo(
	React.forwardRef<ViewInstance, QrScanFromGalleryButtonProps>(function QrScanFromGalleryButton({ onScan, labels, galleryDevice, testID }, ref): React.JSX.Element {
		const text = React.useMemo((): QrScannerLabels => ({ ...DEFAULT_QR_SCANNER_LABELS, ...labels }), [labels]);
		const { scan, busy, message } = useGalleryScan(onScan, text, galleryDevice);
		return (
			<View ref={ref} className="gap-2">
				<Button label={text.scanFromGallery} variant="outline" icon={ImagesIcon} onPress={scan} loading={busy} {...(testID === undefined ? {} : { testID })} />
				{message === null ? null : (
					<Text accessibilityLiveRegion="polite" className="text-center font-sans text-sm text-muted-foreground">
						{message}
					</Text>
				)}
			</View>
		);
	}),
);

/**
 * This device's own scanner: Google's (ML Kit, Play services) on an Android build that has it, the
 * kit's camera scanner everywhere else. Decided once per opening — Play services does not come and go
 * while the app runs. A screen offering both scanners disables Google's where this is `"camera"`.
 */
export function deviceQrScannerEngine(): QrScannerEngine {
	return resolveQrScannerEngine({
		platform: Platform.OS,
		isModernScannerAvailable: CameraView.isModernBarcodeScannerAvailable,
		isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
	});
}

/** The ref reaches the camera scanner's surface while it is open (Google's scanner draws nothing of ours). */
export const QrScanner = React.memo(
	React.forwardRef<ViewInstance, QrScannerProps>(function QrScanner(
		{ visible, onScan, onClose, labels, engine, allowGallery = true, galleryDevice, variant = "default", testID },
		ref,
	): React.JSX.Element | null {
		const text = React.useMemo((): QrScannerLabels => ({ ...DEFAULT_QR_SCANNER_LABELS, ...labels }), [labels]);
		const [preferredEngine] = React.useState((): QrScannerEngine => engine ?? deviceQrScannerEngine());
		/** Google's scanner could not start for this opening: the camera scanner stands in until the scanner closes. */
		const [isGoogleUnavailable, setGoogleUnavailable] = React.useState(false);
		// Closed: the next opening tries Google's scanner again (adjusting state during render, React's documented pattern).
		if (!visible && isGoogleUnavailable) {
			setGoogleUnavailable(false);
		}
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
		return (
			<CameraScanner
				ref={ref}
				visible={visible}
				onScan={onScan}
				onClose={onClose}
				labels={text}
				allowGallery={allowGallery}
				galleryDevice={galleryDevice}
				variant={variant}
				testID={testID}
			/>
		);
	}),
);

interface CameraScannerProps {
	readonly visible: boolean;
	readonly onScan: (data: string) => void;
	readonly onClose: () => void;
	readonly labels: QrScannerLabels;
	readonly allowGallery: boolean;
	readonly galleryDevice: GalleryScanDevice | undefined;
	readonly variant: QrScannerVariant;
	readonly testID: string | undefined;
}

/** The sheet's offset as a fraction of the screen's height: 0 in place, 1 just below the screen. */
/**
 * The kit's own scanner: a full-screen modal over the live camera. The scanner animates itself rather
 * than leaving it to the Modal, which slides only its window: on Android the camera's own surface
 * vanished at once while the scrim slid away, and on iOS the window slid down empty. Here the camera
 * and everything over it are one sheet, kept mounted until it is fully off screen.
 *
 * Each opening mounts a fresh surface — one code to read, the torch off, the permission asked again if
 * still undecided — even when it reopens before the last one finished leaving.
 */
const CameraScanner = React.forwardRef<ViewInstance, CameraScannerProps>(function CameraScanner(
	{ visible, onScan, onClose, labels, allowGallery, galleryDevice, variant, testID },
	ref,
): React.JSX.Element {
	const { height } = useWindowDimensions();
	// Which opening this is (it keys a fresh surface), whether the sheet is presented (shown, or still
	// sliding away: the Modal stays up until it is off screen), and where it is on the way (lib/use-overlay-presence).
	const sheet = useOverlayPresence(visible, SCANNER_SHEET_MOTION);
	const { opening, progress } = sheet;
	const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (OVERLAY_SHOWN - progress.get()) * height }] }));

	return (
		<Modal visible={sheet.presented} animationType="none" transparent onRequestClose={onClose}>
			{sheet.presented ? (
				<StyledAnimatedView className="flex-1" style={sheetStyle}>
					<CameraScannerSurface
						key={opening}
						ref={ref}
						open={visible}
						onScan={onScan}
						onClose={onClose}
						labels={labels}
						allowGallery={allowGallery}
						galleryDevice={galleryDevice}
						variant={variant}
						testID={testID}
					/>
				</StyledAnimatedView>
			) : null}
		</Modal>
	);
});

interface CameraScannerSurfaceProps extends Omit<CameraScannerProps, "visible"> {
	/** `false` while the sheet slides away: it reads no more codes and hands nothing over. */
	readonly open: boolean;
}

/** The empty side of the header, the close button's width, so the title stays centred. */
const HEADER_SPACER_CLASS = "size-11";

const CameraScannerSurface = React.forwardRef<ViewInstance, CameraScannerSurfaceProps>(function CameraScannerSurface(
	{ open, onScan, onClose, labels, allowGallery, galleryDevice, variant, testID },
	ref,
): React.JSX.Element {
	const [permission, requestPermission] = useCameraPermissions();
	const [isTorchOn, setTorchOn] = React.useState(false);
	const [phase, setPhase] = React.useState<ScanPhase>("starting");
	const insets = useSafeAreaInsets();
	const { width, height } = useWindowDimensions();
	const layout = React.useMemo((): ViewfinderLayout => viewfinderLayout(width, height), [width, height]);
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

	// Still looking after a while: the line under the window offers a tip.
	React.useEffect((): (() => void) | undefined => {
		if (phase !== "searching") {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setPhase("slow");
		}, SLOW_SCAN_AFTER_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [phase]);

	// A read code locks the window first — the person sees and feels it was read — then is handed over.
	const onScanRef = React.useRef(onScan);
	React.useEffect((): void => {
		onScanRef.current = onScan;
	}, [onScan]);
	const lockedCode = React.useRef<string | null>(null);
	React.useEffect((): (() => void) | undefined => {
		const code = lockedCode.current;
		if (!open || phase !== "locked" || code === null) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			onScanRef.current(code);
		}, LOCK_HOLD_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [open, phase]);
	const handleBarcode = React.useCallback((result: BarcodeScanningResult): void => {
		lockedCode.current = result.data;
		playSuccessFeedback();
		setPhase("locked");
	}, []);
	const handleCameraReady = React.useCallback((): void => {
		setPhase((current: ScanPhase): ScanPhase => (current === "starting" ? "searching" : current));
	}, []);
	const handleMountError = React.useCallback((): void => {
		setPhase("failed");
	}, []);

	// A code read from a photo ends this opening at once: the photo was the confirmation.
	const handleGalleryScan = React.useCallback(
		(data: string): void => {
			lockedCode.current = null;
			setPhase("locked");
			onScan(data);
		},
		[onScan],
	);
	const gallery = useGalleryScan(handleGalleryScan, labels, galleryDevice);
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
	const showsCamera = isGranted && phase !== "failed";
	return (
		<View ref={ref} testID={testID} className={qrScannerVariants({ variant })}>
			{isGranted ? (
				<ThemedCameraView
					className="absolute inset-0"
					facing="back"
					enableTorch={isTorchOn}
					barcodeScannerSettings={QR_SCANNER_SETTINGS}
					onCameraReady={handleCameraReady}
					onMountError={handleMountError}
					{...(open && (phase === "searching" || phase === "slow") ? { onBarcodeScanned: handleBarcode } : {})}
					testID={testID === undefined ? undefined : `${testID}-camera`}
				/>
			) : null}
			{showsCamera ? <Viewfinder layout={layout} phase={phase} /> : null}
			{showsCamera || phase === "failed" ? (
				<StatusLine layout={layout} text={scanStatusOf(phase, labels, gallery.message)} tone={phase === "locked" ? "success" : "neutral"} />
			) : null}
			<View className="absolute inset-0" style={barsStyle} pointerEvents="box-none">
				<View className="flex-row items-center justify-between px-4 py-2">
					<CloseButton label={labels.close} onPress={onClose} />
					<Text accessibilityRole="header" className="font-sans-semibold text-lg text-scrim-foreground">
						{labels.title}
					</Text>
					<View className={HEADER_SPACER_CLASS} />
				</View>
				{isGranted ? (
					<View className="flex-1" pointerEvents="none" />
				) : (
					<PermissionPanel
						permissionKnown={permission !== null}
						canAskAgain={permission?.canAskAgain ?? true}
						labels={labels}
						galleryMessage={allowGallery ? gallery.message : null}
						onAllow={askAgain}
						onOpenSettings={openSettings}
					/>
				)}
				{showsCamera || allowGallery ? (
					<View className="flex-row justify-center gap-10 px-6 pt-2 pb-6">
						{allowGallery ? (
							<DockButton
								icon={ImagesIcon}
								caption={labels.gallery}
								accessibilityLabel={labels.scanFromGallery}
								onPress={gallery.scan}
								busy={gallery.busy}
								selected={false}
								testID={testID === undefined ? undefined : `${testID}-gallery`}
							/>
						) : null}
						{showsCamera ? (
							<DockButton
								icon={isTorchOn ? FlashlightIcon : FlashlightOffIcon}
								caption={labels.light}
								accessibilityLabel={isTorchOn ? labels.torchOff : labels.torchOn}
								onPress={toggleTorch}
								busy={false}
								selected={isTorchOn}
								testID={testID === undefined ? undefined : `${testID}-torch`}
							/>
						) : null}
					</View>
				) : null}
			</View>
		</View>
	);
});

/** How long the corners take to breathe out and back in while the scanner looks for a code. */
const BREATHE_HALF_MS = 1100;
/** How far the corners breathe out. */
const BREATHE_SCALE = 1.035;
/** How far the corners close in on a read code. */
const LOCKED_SCALE = 0.92;
/** How long the lock takes. */
const LOCK_MS = 220;
/** The lock decelerates into place (the kit's emphasized enter curve). */
const LOCK_EASING = Easing.bezier(0.23, 1, 0.32, 1);

/** How far the scan line stays from the window's edges, so it sweeps inside the brackets. */
const SCAN_LINE_INSET = 14;
/**
 * The glow band around the scan line (`h-7`): its height; the line runs through its middle. The line is
 * the scrim's foreground (white), not the theme's primary: it must read over any camera picture, and the
 * light theme's primary is a dark navy that vanished over the dimmed feed.
 */
const SCAN_LINE_BAND = 28;

/** The corner brackets at the four corners of a box; each corner rounds like the window. */
const BRACKET_CORNERS: readonly string[] = [
	"top-0 left-0 rounded-tl-3xl border-t-4 border-l-4",
	"top-0 right-0 rounded-tr-3xl border-t-4 border-r-4",
	"bottom-0 left-0 rounded-bl-3xl border-b-4 border-l-4",
	"right-0 bottom-0 rounded-br-3xl border-r-4 border-b-4",
];

/**
 * The scrim with the rounded window cut out of it, and the corner brackets on the window. While the
 * scanner looks, the brackets breathe and a scan line sweeps the window down and back up; on a read
 * the line fades where it is, the brackets close in, turn the success colour and a check appears.
 * With Reduce Motion on there is no sweep, and the brackets change in place.
 */
function Viewfinder({ layout, phase }: { readonly layout: ViewfinderLayout; readonly phase: ScanPhase }): React.JSX.Element {
	const reduceMotion = useReducedMotion();
	const breathe = useSharedValue(1);
	const lock = useSharedValue(0);
	const sweep = useSharedValue(0);
	const isLooking = phase === "searching" || phase === "slow";
	const isLocked = phase === "locked";

	React.useEffect((): void => {
		if (isLooking && !reduceMotion) {
			breathe.set(
				withRepeat(
					withSequence(
						withTiming(BREATHE_SCALE, { duration: BREATHE_HALF_MS, easing: Easing.inOut(Easing.quad) }),
						withTiming(1, { duration: BREATHE_HALF_MS, easing: Easing.inOut(Easing.quad) }),
					),
					-1,
				),
			);
			return;
		}
		cancelAnimation(breathe);
		breathe.set(1);
	}, [breathe, isLooking, reduceMotion]);
	// The scan line sweeps down and back up for as long as the scanner looks; it stops where it is on a read.
	const sweeps = isLooking && !reduceMotion;
	React.useEffect((): void => {
		if (sweeps) {
			sweep.set(withRepeat(withTiming(1, SCAN_LINE_MOTION), -1, true));
			return;
		}
		cancelAnimation(sweep);
	}, [sweep, sweeps]);
	React.useEffect((): void => {
		const target = isLocked ? 1 : 0;
		lock.set(reduceMotion ? target : withTiming(target, { duration: LOCK_MS, easing: LOCK_EASING }));
	}, [isLocked, lock, reduceMotion]);

	const bracketsStyle = useAnimatedStyle(() => ({
		transform: [{ scale: breathe.get() * (1 - (1 - LOCKED_SCALE) * lock.get()) }],
	}));
	const searchingStyle = useAnimatedStyle(() => ({ opacity: 1 - lock.get() }));
	const lockedStyle = useAnimatedStyle(() => ({ opacity: lock.get() }));
	const checkStyle = useAnimatedStyle(() => ({ opacity: lock.get(), transform: [{ scale: lock.get() }] }));
	const travel = layout.side - SCAN_LINE_INSET * 2 - SCAN_LINE_BAND;
	const scanLineStyle = useAnimatedStyle(() => ({ opacity: 1 - lock.get(), transform: [{ translateY: SCAN_LINE_INSET + sweep.get() * travel }] }));

	const cutoutStyle = React.useMemo(
		(): ViewStyle => ({
			left: layout.left - layout.cutoutBorder,
			top: layout.top - layout.cutoutBorder,
			width: layout.side + layout.cutoutBorder * 2,
			height: layout.side + layout.cutoutBorder * 2,
			borderWidth: layout.cutoutBorder,
			borderRadius: VIEWFINDER_RADIUS + layout.cutoutBorder,
		}),
		[layout],
	);
	const windowStyle = React.useMemo((): ViewStyle => ({ left: layout.left, top: layout.top, width: layout.side, height: layout.side }), [layout]);
	const bracketsBoxStyle = React.useMemo(() => [windowStyle, bracketsStyle], [windowStyle, bracketsStyle]);

	return (
		<View className="absolute inset-0 overflow-hidden" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			<View className="absolute border-scrim opacity-60" style={cutoutStyle} />
			{!reduceMotion && (isLooking || isLocked) ? (
				<View className="absolute" style={windowStyle}>
					<StyledAnimatedView className="absolute right-0 left-0 h-7 justify-center px-2" style={scanLineStyle} testID="qr-scanner-scan-line">
						<View className="absolute inset-x-3 inset-y-0 rounded-full bg-scrim-foreground opacity-10" />
						<View className="absolute inset-x-2 top-2 bottom-2 rounded-full bg-scrim-foreground opacity-25" />
						<View className="h-1 rounded-full bg-scrim-foreground" />
					</StyledAnimatedView>
				</View>
			) : null}
			<StyledAnimatedView className="absolute" style={bracketsBoxStyle}>
				<StyledAnimatedView className="absolute inset-0" style={searchingStyle}>
					{BRACKET_CORNERS.map((corner: string): React.JSX.Element => (
						<View key={corner} className={cn("absolute size-12 border-scrim-foreground", corner)} />
					))}
				</StyledAnimatedView>
				<StyledAnimatedView className="absolute inset-0" style={lockedStyle}>
					{BRACKET_CORNERS.map((corner: string): React.JSX.Element => (
						<View key={corner} className={cn("absolute size-12 border-success", corner)} />
					))}
				</StyledAnimatedView>
				<View className="absolute inset-0 items-center justify-center">
					<StyledAnimatedView className="size-16 items-center justify-center rounded-full bg-success" style={checkStyle}>
						<Icon icon={CheckIcon} size="xl" weight="bold" colorClassName="accent-scrim-foreground" />
					</StyledAnimatedView>
				</View>
			</StyledAnimatedView>
		</View>
	);
}

/** Space between the window and the line under it. */
const STATUS_GAP = 20;

/**
 * One line under the window, on its own dark pill so it reads over any scene: what the scanner is
 * doing, a tip when it is slow, or that the code was found. Announced as it changes.
 */
function StatusLine({ layout, text, tone }: { readonly layout: ViewfinderLayout; readonly text: string; readonly tone: "neutral" | "success" }): React.JSX.Element {
	const positionStyle = React.useMemo((): ViewStyle => ({ top: layout.top + layout.side + STATUS_GAP }), [layout]);
	return (
		<View className="absolute right-0 left-0 items-center px-8" style={positionStyle} pointerEvents="none">
			<View className="max-w-80 flex-row items-center gap-2 rounded-full px-4 py-2" testID="qr-scanner-status">
				<View className="absolute inset-0 rounded-full bg-scrim opacity-50" />
				{tone === "success" ? <View className="size-2 rounded-full bg-success" /> : null}
				<Text accessibilityLiveRegion="polite" accessibilityRole="text" className="font-sans-medium shrink text-center text-sm text-scrim-foreground">
					{text}
				</Text>
			</View>
		</View>
	);
}

interface PermissionPanelProps {
	/** `false` while the permission is still being read. */
	readonly permissionKnown: boolean;
	readonly canAskAgain: boolean;
	readonly labels: QrScannerLabels;
	/** What came of a photo picked from the dock (no camera needed for that). */
	readonly galleryMessage: string | null;
	readonly onAllow: () => void;
	readonly onOpenSettings: () => void;
}

/** Why the camera is needed, with the one way forward: allow it, or turn it back on in Settings. */
function PermissionPanel({ permissionKnown, canAskAgain, labels, galleryMessage, onAllow, onOpenSettings }: PermissionPanelProps): React.JSX.Element {
	if (!permissionKnown) {
		return <View className="flex-1" />;
	}
	return (
		<View className="flex-1 items-center justify-center gap-5 px-8">
			<View className="size-20 items-center justify-center rounded-full">
				<View className="absolute inset-0 rounded-full bg-scrim-foreground opacity-10" />
				<Icon icon={CameraIcon} size="2xl" colorClassName="accent-scrim-foreground" />
			</View>
			<View className="gap-2">
				<Text accessibilityRole="header" className="text-center font-heading text-2xl text-scrim-foreground">
					{labels.permissionTitle}
				</Text>
				<Text className="text-center font-sans text-base text-scrim-foreground opacity-80">
					{canAskAgain ? labels.permissionDescription : labels.permissionBlockedDescription}
				</Text>
			</View>
			{canAskAgain ? <Button label={labels.allowCamera} onPress={onAllow} /> : <Button label={labels.openSettings} onPress={onOpenSettings} />}
			{galleryMessage === null ? null : (
				<Text accessibilityLiveRegion="polite" className="text-center font-sans text-sm text-scrim-foreground">
					{galleryMessage}
				</Text>
			)}
		</View>
	);
}

interface CloseButtonProps {
	readonly label: string;
	readonly onPress: () => void;
}

/** The round 44 pt close control over the camera: a light glyph on a dim disc, legible on any scene. */
function CloseButton({ label, onPress }: CloseButtonProps): React.JSX.Element {
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="size-11 items-center justify-center rounded-full active:opacity-80">
			<View className="absolute inset-0 rounded-full bg-scrim opacity-40" />
			<Icon icon={XIcon} size="md" colorClassName="accent-scrim-foreground" />
		</Pressable>
	);
}

interface DockButtonProps {
	readonly icon: React.ComponentProps<typeof Icon>["icon"];
	/** The word under the disc ("Gallery", "Light"). */
	readonly caption: string;
	/** What the control does, for screen readers ("Scan from gallery", "Turn on flashlight"). */
	readonly accessibilityLabel: string;
	readonly onPress: () => void;
	/** Working (a photo is being picked or read): the disc shows a spinner and ignores presses. */
	readonly busy: boolean;
	/** On (the light): the disc fills, so its state reads at a glance. */
	readonly selected: boolean;
	readonly testID: string | undefined;
}

/** A thumb-height control in the dock: a 56 pt disc with its caption under it. */
function DockButton({ icon, caption, accessibilityLabel, onPress, busy, selected, testID }: DockButtonProps): React.JSX.Element {
	const state = React.useMemo(
		(): { readonly disabled: boolean; readonly busy: boolean; readonly selected: boolean } => ({ disabled: busy, busy, selected }),
		[busy, selected],
	);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={state}
			disabled={busy}
			onPress={onPress}
			testID={testID}
			className="items-center gap-2 active:opacity-80">
			<View className="size-14 items-center justify-center rounded-full">
				<View className={cn("absolute inset-0 rounded-full", selected ? "bg-scrim-foreground" : "bg-scrim opacity-50")} />
				{selected ? null : <View className="absolute inset-0 rounded-full border border-scrim-foreground opacity-20" />}
				{busy ? (
					<ActivityIndicator size="small" colorClassName="accent-scrim-foreground" />
				) : (
					<Icon icon={icon} size="lg" colorClassName={selected ? "accent-scrim" : "accent-scrim-foreground"} />
				)}
			</View>
			<Text className="font-sans-medium text-xs text-scrim-foreground">{caption}</Text>
		</Pressable>
	);
}
