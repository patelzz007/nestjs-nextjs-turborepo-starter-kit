"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { ImageCropDialogProps } from "./image-crop-dialog";

function renderNothingWhileLoading(): null {
	return null;
}

const LazyImageCropDialog = dynamic(() => import("./image-crop-dialog").then((module) => module.ImageCropDialog), {
	ssr: false,
	loading: renderNothingWhileLoading,
});

/**
 * `ImageCropDialog` without the cropper (canvas, pointer gestures) in any page's first bundle: the chunk
 * loads only once a photo is picked (`source` set). A closed dialog renders nothing — on the server too —
 * so there is no layout to hold while it loads. Same props, same dialog.
 */
export default function ImageCropDialogClientOnly(props: ImageCropDialogProps): React.JSX.Element | null {
	return props.source === null ? null : <LazyImageCropDialog {...props} />;
}
