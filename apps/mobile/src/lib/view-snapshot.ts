// ============================================
// lib/view-snapshot.ts - a photo of a view, straight from react-native-view-shot's native module
// ============================================
// The package's JavaScript is not imported: its `exports` send TypeScript to its source ahead of its
// declarations, and that source does not meet this app's compiler settings. The native module is
// small and stable, so the app speaks to it through this typed port instead, the way it reaches its
// other native modules (features/pdf-viewer/pdf-renderer-module.ts). A build without the module
// (an older custom build) gets `null` and does without photos.

import { findNodeHandle, TurboModuleRegistry, type TurboModule, type ViewInstance } from "react-native";

/** The native module react-native-view-shot registers. */
export const VIEW_SHOT_NATIVE_MODULE = "RNViewShot";

/** What the native capture is told (the package's own defaults, with ours on top). */
export interface ViewShotOptions {
	readonly format: "jpg" | "png";
	/** 0–1. */
	readonly quality: number;
	readonly result: "tmpfile";
	readonly snapshotContentContainer: false;
	readonly handleGLSurfaceViewOnAndroid: false;
}

export interface ViewShotNativeModule extends TurboModule {
	captureRef(viewTag: number, options: ViewShotOptions): Promise<string>;
	releaseCapture(uri: string): void;
}

/** The module, or `null` where the build does not include it. */
export function loadViewShotModule(): ViewShotNativeModule | null {
	return TurboModuleRegistry.get<ViewShotNativeModule>(VIEW_SHOT_NATIVE_MODULE) ?? null;
}

/** A file URI of `view` as it looks now, or a refusal when it is not on screen. */
export function snapshotView(module: ViewShotNativeModule, view: ViewInstance, options: ViewShotOptions): Promise<string> {
	const tag = findNodeHandle(view);
	return tag === undefined ? Promise.reject(new Error("The view is not on screen")) : module.captureRef(tag, options);
}
