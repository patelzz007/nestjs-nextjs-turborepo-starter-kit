"use client";

import {
	IMAGE_RESIZE_HANDLES,
	IMAGE_RESIZE_LARGE_STEP_PX,
	IMAGE_RESIZE_STEP_PX,
	isSameImageSize,
	resizeImageByHandle,
	resolveImageResizeConstraints,
	type ImageResizeConstraints,
	type ImageResizeDelta,
	type ImageResizeHandle,
	type ImageSize,
} from "@workspace/shared";
import { useImageLoadingStatus } from "@workspace/ui/hooks/use-image-loading-status";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { ImageOff } from "lucide-react";
import * as React from "react";

export interface ImageResizerLabels {
	/** Accessible name of a handle, e.g. "Resize from the bottom-right corner". */
	readonly handle: (handle: ImageResizeHandle) => string;
	/** How to operate a handle, read after its name. */
	readonly instructions: string;
	/** The size announced after a keyboard step, e.g. "400 by 300 pixels". */
	readonly size: (size: ImageSize) => string;
}

/**
 * The frame. `outline` always draws its edge; `ghost` draws it (and the handles) only on hover or
 * while a handle has focus — on touch screens, which cannot hover, the handles always show.
 */
export const imageResizerVariants = cva("group/image-resizer relative inline-block max-w-none touch-none bg-muted select-none", {
	variants: {
		variant: {
			outline: "ring-1 ring-border",
			ghost: "focus-within:ring-1 focus-within:ring-ring hover:ring-1 hover:ring-border",
		},
		state: {
			default: "",
			disabled: "opacity-60",
		},
	},
	defaultVariants: { variant: "outline", state: "default" },
});

/** How the picture fills the frame when its shape differs from the image's: crop it, letterbox it, or stretch it. */
export const imageResizerImageVariants = cva("pointer-events-none absolute inset-0 size-full", {
	variants: {
		fit: {
			cover: "object-cover",
			contain: "object-contain",
			fill: "object-fill",
		},
	},
	defaultVariants: { fit: "cover" },
});

/** One handle: a hit area of at least 24 px (WCAG 2.5.8) centred on the frame's corner or edge, around a small visible knob. */
export const imageResizerHandleVariants = cva(
	"absolute flex items-center justify-center rounded-full outline-none focus-visible:[&>span]:ring-3 focus-visible:[&>span]:ring-ring/50",
	{
		variants: {
			size: {
				sm: "size-6",
				md: "size-8",
			},
			variant: {
				outline: "",
				ghost: "opacity-0 group-focus-within/image-resizer:opacity-100 group-hover/image-resizer:opacity-100 pointer-coarse:opacity-100",
			},
			// Physical sides, not logical ones: a handle's name says which side it moves, in every writing direction.
			handle: {
				"top-left": "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
				top: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
				"top-right": "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
				right: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
				"bottom-right": "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
				bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
				"bottom-left": "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
				left: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
			},
		},
		defaultVariants: { size: "md", variant: "outline" },
	},
);

/** The visible knob inside a handle's hit area. */
export const imageResizerKnobVariants = cva("pointer-events-none rounded-full border-2 border-primary bg-background shadow-xs transition-shadow", {
	variants: {
		size: {
			sm: "size-2.5",
			md: "size-3",
		},
	},
	defaultVariants: { size: "md" },
});

type ImageResizerVariantProps = VariantProps<typeof imageResizerVariants>;
export type ImageResizerVariant = NonNullable<ImageResizerVariantProps["variant"]>;
export type ImageResizerFit = NonNullable<VariantProps<typeof imageResizerImageVariants>["fit"]>;
export type ImageResizerSize = NonNullable<VariantProps<typeof imageResizerHandleVariants>["size"]>;

export interface ImageResizerProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children" | "onChange" | "defaultValue"> {
	/** The image's URL. */
	readonly src: string;
	/** `<img alt>` — what the image shows; `""` for a decorative one. */
	readonly alt: string;
	/** The rendered size in CSS pixels (controlled). */
	readonly value: ImageSize;
	/** Every new size while a handle is dragged, and after each arrow-key step. */
	readonly onValueChange: (size: ImageSize) => void;
	/** The size a drag ended at, or an arrow-key step reached — save it here, not on every move. */
	readonly onValueCommitted?: ((size: ImageSize) => void) | undefined;
	/** The smallest width, in CSS pixels (default `DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX`). */
	readonly minWidth?: number | undefined;
	readonly minHeight?: number | undefined;
	/** The largest width, in CSS pixels — e.g. the width of the column the image sits in (default: none). */
	readonly maxWidth?: number | undefined;
	readonly maxHeight?: number | undefined;
	/** Width ÷ height to keep while resizing (e.g. the image's natural ratio); omitted, the sides change independently. */
	readonly aspectRatio?: number | undefined;
	/** The handles shown, in any order (default: all eight; `IMAGE_RESIZE_CORNER_HANDLES` for corners only). */
	readonly handles?: readonly ImageResizeHandle[] | undefined;
	/** Pixels per arrow-key press, and per Shift + arrow-key press. */
	readonly step?: number | undefined;
	readonly largeStep?: number | undefined;
	/** Shows the image at its size with no handles. */
	readonly disabled?: boolean | undefined;
	readonly variant?: ImageResizerVariant | undefined;
	readonly size?: ImageResizerSize | undefined;
	readonly fit?: ImageResizerFit | undefined;
	/** Shown in place of the image when it fails to load. */
	readonly fallback?: React.ReactNode;
	/** Per-usage overrides of the `imageResizer` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"imageResizer"> | undefined;
}

interface DragStart {
	readonly pointerId: number;
	readonly handle: ImageResizeHandle;
	readonly clientX: number;
	readonly clientY: number;
	readonly size: ImageSize;
}

/** The primary mouse button, a touch, or a pen tip — the only pointers that start a drag. */
const PRIMARY_BUTTON = 0;
const NO_TRAVEL = 0;

/** The travel one arrow key asks for, or `null` for any other key. */
function arrowKeyDelta(key: string, distance: number): ImageResizeDelta | null {
	switch (key) {
		case "ArrowLeft":
			return { x: -distance, y: NO_TRAVEL };
		case "ArrowRight":
			return { x: distance, y: NO_TRAVEL };
		case "ArrowUp":
			return { x: NO_TRAVEL, y: -distance };
		case "ArrowDown":
			return { x: NO_TRAVEL, y: distance };
		default:
			return null;
	}
}

interface ImageResizerHandleProps {
	readonly handle: ImageResizeHandle;
	readonly label: string;
	readonly instructionsId: string;
	readonly size: ImageResizerSize;
	readonly variant: ImageResizerVariant;
	readonly onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, handle: ImageResizeHandle) => void;
	readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, handle: ImageResizeHandle) => void;
	readonly onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
	readonly onPointerEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
}

const ImageResizerHandle = React.memo(function ImageResizerHandle({
	handle,
	label,
	instructionsId,
	size,
	variant,
	onPointerDown,
	onKeyDown,
	onPointerMove,
	onPointerEnd,
}: ImageResizerHandleProps): React.JSX.Element {
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>): void => {
			onPointerDown(event, handle);
		},
		[handle, onPointerDown],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>): void => {
			onKeyDown(event, handle);
		},
		[handle, onKeyDown],
	);
	return (
		<button
			type="button"
			aria-label={label}
			aria-describedby={instructionsId}
			data-slot="image-resizer-handle"
			data-handle={handle}
			onPointerDown={handlePointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerEnd}
			onPointerCancel={onPointerEnd}
			onKeyDown={handleKeyDown}
			className={imageResizerHandleVariants({ size, variant, handle })}>
			<span aria-hidden="true" className={imageResizerKnobVariants({ size })} />
		</button>
	);
});

/**
 * An image the user resizes by dragging the handles on its corners and edges — or, from the
 * keyboard, by focusing a handle and pressing the arrow keys (Shift for larger steps; Escape
 * cancels a drag). The size stays within the bounds and, with `aspectRatio`, keeps its shape;
 * the geometry is `resizeImageByHandle` from `@workspace/shared`, the same the native kit uses.
 * Controlled and data-agnostic: the caller owns the size, and saves it from `onValueCommitted`.
 * The ref reaches the frame.
 */
const ImageResizer = React.forwardRef<HTMLDivElement, ImageResizerProps>(function ImageResizer(
	{
		src,
		alt,
		value,
		onValueChange,
		onValueCommitted,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		aspectRatio,
		handles = IMAGE_RESIZE_HANDLES,
		step = IMAGE_RESIZE_STEP_PX,
		largeStep = IMAGE_RESIZE_LARGE_STEP_PX,
		disabled = false,
		variant = "outline",
		size = "md",
		fit = "cover",
		fallback,
		labels: labelsOverride,
		className,
		style,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("imageResizer", labelsOverride);
	const instructionsId = React.useId();
	const loadingStatus = useImageLoadingStatus(src);
	const constraints = React.useMemo(
		(): ImageResizeConstraints => resolveImageResizeConstraints({ minWidth, minHeight, maxWidth, maxHeight, aspectRatio }),
		[aspectRatio, maxHeight, maxWidth, minHeight, minWidth],
	);
	const drag = React.useRef<DragStart | null>(null);
	// The last size reported during the current drag, so `onValueCommitted` gets exactly that.
	const lastReported = React.useRef<ImageSize>(value);
	// Display state only: the size a keyboard step announced (drags announce nothing, or every move would be read out).
	const [announcement, setAnnouncement] = React.useState("");

	const report = React.useCallback(
		(next: ImageSize): void => {
			if (!isSameImageSize(next, lastReported.current)) {
				lastReported.current = next;
				onValueChange(next);
			}
		},
		[onValueChange],
	);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>, handle: ImageResizeHandle): void => {
			if (event.button !== PRIMARY_BUTTON) {
				return;
			}
			// No text selection or native image drag while resizing; focus still moves to the handle.
			event.preventDefault();
			event.currentTarget.focus();
			event.currentTarget.setPointerCapture(event.pointerId);
			lastReported.current = value;
			drag.current = { pointerId: event.pointerId, handle, clientX: event.clientX, clientY: event.clientY, size: value };
		},
		[value],
	);

	const handlePointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>): void => {
			const start = drag.current;
			if (start?.pointerId !== event.pointerId) {
				return;
			}
			report(resizeImageByHandle(start.size, start.handle, { x: event.clientX - start.clientX, y: event.clientY - start.clientY }, constraints));
		},
		[constraints, report],
	);

	const handlePointerEnd = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>): void => {
			const start = drag.current;
			if (start?.pointerId !== event.pointerId) {
				return;
			}
			drag.current = null;
			if (!isSameImageSize(start.size, lastReported.current)) {
				onValueCommitted?.(lastReported.current);
			}
		},
		[onValueCommitted],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>, handle: ImageResizeHandle): void => {
			const start = drag.current;
			if (event.key === "Escape" && start !== null) {
				// Cancel the drag in progress: back to the size it started at.
				event.preventDefault();
				drag.current = null;
				report(start.size);
				return;
			}
			const delta = arrowKeyDelta(event.key, event.shiftKey ? largeStep : step);
			if (delta === null) {
				return;
			}
			event.preventDefault();
			const next = resizeImageByHandle(value, handle, delta, constraints);
			if (isSameImageSize(next, value)) {
				return;
			}
			lastReported.current = next;
			onValueChange(next);
			onValueCommitted?.(next);
			setAnnouncement(labels.size(next));
		},
		[constraints, labels, largeStep, onValueChange, onValueCommitted, report, step, value],
	);

	const frameStyle = React.useMemo((): React.CSSProperties => ({ ...style, width: value.width, height: value.height }), [style, value.height, value.width]);
	const isBroken = loadingStatus === "error";

	return (
		<div
			ref={ref}
			data-slot="image-resizer"
			data-disabled={disabled ? "" : undefined}
			className={cn(imageResizerVariants({ variant, state: disabled ? "disabled" : "default" }), className)}
			style={frameStyle}
			{...props}>
			{isBroken ? (
				<div data-slot="image-resizer-fallback" className="absolute inset-0 flex items-center justify-center text-muted-foreground/60">
					{fallback ?? <ImageOff className="size-6" aria-hidden="true" />}
					{alt.length > 0 ? <span className="sr-only">{alt}</span> : null}
				</div>
			) : (
				<img
					src={src}
					alt={alt}
					draggable={false}
					decoding="async"
					data-slot="image-resizer-image"
					className={cn(
						imageResizerImageVariants({ fit }),
						"transition-opacity duration-300 motion-reduce:transition-none",
						loadingStatus === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
			{disabled ? null : (
				<>
					{handles.map((handle: ImageResizeHandle): React.JSX.Element => (
						<ImageResizerHandle
							key={handle}
							handle={handle}
							label={labels.handle(handle)}
							instructionsId={instructionsId}
							size={size}
							variant={variant}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerEnd={handlePointerEnd}
							onKeyDown={handleKeyDown}
						/>
					))}
					<span id={instructionsId} hidden>
						{labels.instructions}
					</span>
					<span role="status" aria-live="polite" className="sr-only" data-slot="image-resizer-announcement">
						{announcement}
					</span>
				</>
			)}
		</div>
	);
});
ImageResizer.displayName = "ImageResizer";

export { ImageResizer };
