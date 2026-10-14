"use client";

import { Slider } from "@workspace/ui/components/slider";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import {
	cropExtendsBeyondPhoto,
	moveCropArea,
	resizeCropArea,
	widestCropWidth,
	type CropArea,
	type CropBounds,
	type CropZoomOutLimit,
} from "@workspace/ui/lib/media/crop-area";
import * as React from "react";
import { z } from "zod";

export interface ImageCropperLabels {
	/** Accessible description of the crop preview (dragging it is the pointer shortcut for the sliders). */
	readonly region: string;
	/** Name of the zoom slider. */
	readonly zoom: string;
	/** Name of the slider that moves the crop sideways. */
	readonly horizontal: string;
	/** Name of the slider that moves the crop up and down. */
	readonly vertical: string;
}

export interface ImageCropperProps {
	/** The photo's URL (e.g. an object URL of the picked file). */
	readonly src: string;
	/** The photo's upright size in pixels. */
	readonly bounds: CropBounds;
	/** Width ÷ height of the crop (and the frame). */
	readonly aspect: number;
	/** The narrowest crop allowed, in photo pixels — zooming stops there, so the crop keeps this resolution. */
	readonly minCropWidth: number;
	/**
	 * How far zooming out goes: `fill` (default) stops when the photo fills the
	 * frame; `whole-photo` goes on until the entire photo shows, the room around
	 * it filled with a blurred copy of the photo (as `exportPreparedImage` draws it).
	 */
	readonly zoomOutLimit?: CropZoomOutLimit | undefined;
	/** The crop, in photo pixels (controlled). */
	readonly value: CropArea;
	readonly onValueChange: (area: CropArea) => void;
	readonly disabled?: boolean | undefined;
	readonly className?: string | undefined;
	/** Per-usage overrides of the `imageCropper` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"imageCropper"> | undefined;
}

/** Granularity of the zoom slider (zoom factor). */
const ZOOM_SLIDER_STEP = 0.01;
/** Granularity of the position sliders (share of the room to move). */
const POSITION_SLIDER_STEP = 0.005;

/** Base UI reports a single thumb's value as a number. */
const SingleSliderValueSchema = z.number();

interface DragStart {
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly area: CropArea;
	/** Photo pixels per screen pixel at the start of the drag. */
	readonly scale: number;
}

interface CropSliderProps {
	readonly label: string;
	readonly min: number;
	readonly max: number;
	readonly step: number;
	readonly value: number;
	readonly onValueChange: (value: number) => void;
	readonly disabled: boolean;
	readonly slot: string;
}

/** One labelled cropper slider (Base UI names the thumb's input from the root's `aria-labelledby`). */
function CropSlider({ label, min, max, step, value, onValueChange, disabled, slot }: CropSliderProps): React.JSX.Element {
	const labelId = React.useId();
	const handleValueChange = React.useCallback(
		(next: number | readonly number[]): void => {
			const parsed = SingleSliderValueSchema.safeParse(next);
			if (parsed.success) {
				onValueChange(parsed.data);
			}
		},
		[onValueChange],
	);
	return (
		<div className="grid grid-cols-[7rem_1fr] items-center gap-3" data-slot={slot}>
			<span id={labelId} className="text-sm text-muted-foreground">
				{label}
			</span>
			<Slider aria-labelledby={labelId} min={min} max={max} step={step} value={value} onValueChange={handleValueChange} disabled={disabled} />
		</div>
	);
}

/**
 * Chooses a fixed-shape region of a photo: the frame shows exactly the crop.
 * Sliders zoom and move it (left to right, top to bottom — each only when the
 * photo has room that way); dragging the photo is the pointer shortcut. The crop never leaves the photo (with
 * `zoomOutLimit="whole-photo"` it may grow past it, the photo centred) and never gets narrower than
 * `minCropWidth`, so whatever is chosen keeps the resolution its use needs.
 * Controlled and data-agnostic: the caller owns the crop and renders it.
 */
const ImageCropper = React.forwardRef<HTMLDivElement, ImageCropperProps>(function ImageCropper(
	{ src, bounds, aspect, minCropWidth, zoomOutLimit = "fill", value, onValueChange, disabled = false, className, labels: labelsOverride },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("imageCropper", labelsOverride);
	const drag = React.useRef<DragStart | null>(null);
	const widest = widestCropWidth(bounds, aspect, zoomOutLimit);
	const maxZoom = widest / Math.min(minCropWidth, widest);
	const zoom = widest / value.width;
	const canZoom = maxZoom > 1;

	const slackX = bounds.width - value.width;
	const slackY = bounds.height - value.height;

	const handleZoomChange = React.useCallback(
		(nextZoom: number): void => {
			onValueChange(resizeCropArea(value, widest / nextZoom, bounds, aspect, minCropWidth, zoomOutLimit));
		},
		[aspect, bounds, minCropWidth, onValueChange, value, widest, zoomOutLimit],
	);

	const handleHorizontalChange = React.useCallback(
		(share: number): void => {
			onValueChange(moveCropArea(value, share * slackX - value.x, 0, bounds));
		},
		[bounds, onValueChange, slackX, value],
	);

	const handleVerticalChange = React.useCallback(
		(share: number): void => {
			onValueChange(moveCropArea(value, 0, share * slackY - value.y, bounds));
		},
		[bounds, onValueChange, slackY, value],
	);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (disabled) {
				return;
			}
			event.currentTarget.setPointerCapture(event.pointerId);
			const frameWidth = event.currentTarget.getBoundingClientRect().width;
			drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, area: value, scale: frameWidth > 0 ? value.width / frameWidth : 1 };
		},
		[disabled, value],
	);

	const handlePointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			const start = drag.current;
			if (start?.pointerId !== event.pointerId) {
				return;
			}
			// Dragging the photo right shows more of its left side: the crop moves the other way.
			onValueChange(moveCropArea(start.area, -(event.clientX - start.clientX) * start.scale, -(event.clientY - start.clientY) * start.scale, bounds));
		},
		[bounds, onValueChange],
	);

	const handlePointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
		if (drag.current?.pointerId === event.pointerId) {
			drag.current = null;
		}
	}, []);

	return (
		<div ref={ref} data-slot="image-cropper" className={cn("flex flex-col gap-4", className)}>
			<div
				aria-label={labels.region}
				role="img"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerEnd}
				data-slot="image-cropper-frame"
				className={cn(
					"relative w-full touch-none overflow-hidden rounded-lg bg-muted select-none",
					disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing",
				)}
				style={{ aspectRatio: String(aspect) }}>
				{cropExtendsBeyondPhoto(value, bounds) ? (
					// The room around the whole photo: a soft, enlarged copy of it, as the exported image has. Enlarged a quarter,
					// so the blur's own faded edge stays outside the frame.
					<img
						src={src}
						alt=""
						draggable={false}
						data-slot="image-cropper-backdrop"
						className="pointer-events-none absolute inset-0 size-full scale-125 object-cover blur-2xl"
					/>
				) : null}
				<img
					src={src}
					alt=""
					draggable={false}
					className="pointer-events-none absolute max-w-none"
					style={{
						width: `${String((bounds.width / value.width) * 100)}%`,
						height: `${String((bounds.height / value.height) * 100)}%`,
						left: `${String((-value.x / value.width) * 100)}%`,
						top: `${String((-value.y / value.height) * 100)}%`,
					}}
				/>
				{/* Rule-of-thirds guides help frame the subject; they never block the drag. */}
				<div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
					{Array.from({ length: 9 }, (_, cell) => (
						<span key={cell} className="border-[0.5px] border-white/25" />
					))}
				</div>
			</div>
			<div className="flex flex-col gap-3">
				{canZoom ? (
					<CropSlider
						label={labels.zoom}
						min={1}
						max={maxZoom}
						step={ZOOM_SLIDER_STEP}
						value={zoom}
						onValueChange={handleZoomChange}
						disabled={disabled}
						slot="image-cropper-zoom"
					/>
				) : null}
				{slackX > 0 ? (
					<CropSlider
						label={labels.horizontal}
						min={0}
						max={1}
						step={POSITION_SLIDER_STEP}
						value={value.x / slackX}
						onValueChange={handleHorizontalChange}
						disabled={disabled}
						slot="image-cropper-horizontal"
					/>
				) : null}
				{slackY > 0 ? (
					<CropSlider
						label={labels.vertical}
						min={0}
						max={1}
						step={POSITION_SLIDER_STEP}
						value={value.y / slackY}
						onValueChange={handleVerticalChange}
						disabled={disabled}
						slot="image-cropper-vertical"
					/>
				) : null}
			</div>
		</div>
	);
});
ImageCropper.displayName = "ImageCropper";

export { ImageCropper };
