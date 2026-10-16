// A picture the user resizes by dragging the handles on its corners and edges
// (the web kit's `ImageResizer`). Pure JavaScript: React Native's gesture
// responder on each handle, and the shared geometry (`resizeImageByHandle`
// from @workspace/shared) the web kit and the docs site use too, so every
// platform clamps and keeps the aspect ratio the same way.
// Controlled and data-agnostic: `value` in, `onChange(next)` out while a handle
// is dragged, and `onChangeEnd(final)` once it is let go. Screen readers hear
// each handle as an adjustable control: swiping up grows the picture from it,
// swiping down shrinks it.
//
//   ●━━━━━━●━━━━━━●
//   ┃   picture   ┃   drag a ● to resize
//   ●             ●
//   ┃             ┃
//   ●━━━━━━●━━━━━━●

import {
	IMAGE_RESIZE_HANDLES,
	IMAGE_RESIZE_STEP_PX,
	isSameImageSize,
	nudgeImageSize,
	resizeImageByHandle,
	resolveImageResizeConstraints,
	type ImageResizeConstraints,
	type ImageResizeHandle,
	type ImageSize,
} from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import ImageOffIcon from "lucide-react-native/icons/image-off";
import * as React from "react";
import { View, type AccessibilityActionEvent, type GestureResponderEvent } from "react-native";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { Icon } from "./icon";

/** expo-image's view with Uniwind's `className`. */
const StyledImage = withUniwind(Image);

/** The frame: `outline` draws its edge, `plain` leaves the picture bare (the handles still show). */
export const imageResizerVariants = cva("relative bg-muted", {
	variants: {
		variant: {
			outline: "border border-border",
			plain: "",
		},
		state: {
			default: "",
			disabled: "opacity-60",
		},
	},
	defaultVariants: { variant: "outline", state: "default" },
});

/**
 * One handle: a 44 pt touch area (rules/04) centred on the frame's corner or edge
 * (22 pt — half of it — outside the frame), around a small visible knob.
 */
export const imageResizerHandleVariants = cva("absolute size-11 items-center justify-center", {
	variants: {
		handle: {
			"top-left": "-top-5.5 -left-5.5",
			top: "-top-5.5 left-1/2 -ml-5.5",
			"top-right": "-top-5.5 -right-5.5",
			right: "top-1/2 -right-5.5 -mt-5.5",
			"bottom-right": "-right-5.5 -bottom-5.5",
			bottom: "-bottom-5.5 left-1/2 -ml-5.5",
			"bottom-left": "-bottom-5.5 -left-5.5",
			left: "top-1/2 -left-5.5 -mt-5.5",
		},
	},
});

export const imageResizerKnobVariants = cva("rounded-full border-2 border-primary bg-background", {
	variants: {
		size: {
			sm: "size-3",
			md: "size-4",
		},
	},
	defaultVariants: { size: "md" },
});

type ImageResizerVariantProps = VariantProps<typeof imageResizerVariants>;
export type ImageResizerVariant = NonNullable<ImageResizerVariantProps["variant"]>;
export type ImageResizerSize = NonNullable<VariantProps<typeof imageResizerKnobVariants>["size"]>;
/** How the picture fills the frame when their shapes differ: crop it, letterbox it, or stretch it. */
export type ImageResizerFit = "cover" | "contain" | "fill";

/** Where each handle sits, as the default names read it out. */
const HANDLE_PLACES: Readonly<Record<ImageResizeHandle, string>> = {
	"top-left": "top-left corner",
	top: "top edge",
	"top-right": "top-right corner",
	right: "right edge",
	"bottom-right": "bottom-right corner",
	bottom: "bottom edge",
	"bottom-left": "bottom-left corner",
	left: "left edge",
};

/** The default accessible name of a handle; generic and overridable. */
export function defaultImageResizerHandleLabel(handle: ImageResizeHandle): string {
	return `Resize from the ${HANDLE_PLACES[handle]}`;
}

/** The default spoken size; generic and overridable. */
export function defaultImageResizerSizeText(size: ImageSize): string {
	return `${String(size.width)} by ${String(size.height)} points`;
}

/** The actions screen readers offer (swipe up / down on iOS, volume keys on Android). */
const ADJUSTABLE_ACTIONS: readonly { readonly name: string }[] = [{ name: "increment" }, { name: "decrement" }];

export interface ImageResizerProps {
	/** The picture's address; `null` (or a failed load) shows a placeholder. */
	readonly uri: string | null;
	/** What the picture shows, for screen readers. */
	readonly alt: string;
	/** The rendered size in points (controlled). */
	readonly value: ImageSize;
	/** Every new size while a handle is dragged, and on each screen-reader step. */
	readonly onChange: (size: ImageSize) => void;
	/** The size a handle was let go at, or a screen-reader step reached — save it here, not on every move. */
	readonly onChangeEnd?: ((size: ImageSize) => void) | undefined;
	/** The smallest width, in points (default `DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX`). */
	readonly minWidth?: number | undefined;
	readonly minHeight?: number | undefined;
	/** The largest width, in points — e.g. the screen's content width (default: none). */
	readonly maxWidth?: number | undefined;
	readonly maxHeight?: number | undefined;
	/** Width ÷ height to keep while resizing (e.g. the picture's natural ratio); omitted, the sides change independently. */
	readonly aspectRatio?: number | undefined;
	/** The handles shown, in any order (default: all eight; `IMAGE_RESIZE_CORNER_HANDLES` for corners only). */
	readonly handles?: readonly ImageResizeHandle[] | undefined;
	/** Points per screen-reader step. */
	readonly step?: number | undefined;
	/** Names a handle for screen readers: `"bottom-right"` → "Resize from the bottom-right corner". */
	readonly handleLabel?: ((handle: ImageResizeHandle) => string) | undefined;
	/** What screen readers say for a size: "400 by 300 points". */
	readonly sizeText?: ((size: ImageSize) => string) | undefined;
	/** Shows the picture at its size with no handles. */
	readonly disabled?: boolean | undefined;
	readonly variant?: ImageResizerVariant | undefined;
	readonly size?: ImageResizerSize | undefined;
	readonly fit?: ImageResizerFit | undefined;
	/** Extra classes for the frame, merged last (layout: `mt-4`, `self-center`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Where a drag started: the handle, the touch's place on the screen, and the size then. */
interface DragStart {
	readonly handle: ImageResizeHandle;
	readonly pageX: number;
	readonly pageY: number;
	readonly size: ImageSize;
}

interface ImageResizerHandleProps {
	readonly handle: ImageResizeHandle;
	readonly label: string;
	readonly sizeText: string;
	readonly size: ImageResizerSize;
	readonly onGrant: (handle: ImageResizeHandle, event: GestureResponderEvent) => void;
	readonly onMove: (event: GestureResponderEvent) => void;
	readonly onEnd: () => void;
	readonly onAdjust: (handle: ImageResizeHandle, event: AccessibilityActionEvent) => void;
	readonly testID: string | undefined;
}

const claimTouch = (): boolean => true;
const keepTouch = (): boolean => false;

const ImageResizerHandle = React.memo(function ImageResizerHandle({
	handle,
	label,
	sizeText,
	size,
	onGrant,
	onMove,
	onEnd,
	onAdjust,
	testID,
}: ImageResizerHandleProps): React.JSX.Element {
	const accessibilityValue = React.useMemo(() => ({ text: sizeText }), [sizeText]);
	const grant = React.useCallback(
		(event: GestureResponderEvent): void => {
			onGrant(handle, event);
		},
		[handle, onGrant],
	);
	const adjust = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			onAdjust(handle, event);
		},
		[handle, onAdjust],
	);
	return (
		<View
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={label}
			accessibilityValue={accessibilityValue}
			accessibilityActions={ADJUSTABLE_ACTIONS}
			onAccessibilityAction={adjust}
			onStartShouldSetResponder={claimTouch}
			onMoveShouldSetResponder={claimTouch}
			onResponderTerminationRequest={keepTouch}
			onResponderGrant={grant}
			onResponderMove={onMove}
			onResponderRelease={onEnd}
			onResponderTerminate={onEnd}
			testID={testID}
			className={imageResizerHandleVariants({ handle })}>
			<View pointerEvents="none" className={imageResizerKnobVariants({ size })} />
		</View>
	);
});

export const ImageResizer = React.memo(
	React.forwardRef<View, ImageResizerProps>(function ImageResizer(
		{
			uri,
			alt,
			value,
			onChange,
			onChangeEnd,
			minWidth,
			minHeight,
			maxWidth,
			maxHeight,
			aspectRatio,
			handles = IMAGE_RESIZE_HANDLES,
			step = IMAGE_RESIZE_STEP_PX,
			handleLabel = defaultImageResizerHandleLabel,
			sizeText = defaultImageResizerSizeText,
			disabled = false,
			variant = "outline",
			size = "md",
			fit = "cover",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const constraints = React.useMemo(
			(): ImageResizeConstraints => resolveImageResizeConstraints({ minWidth, minHeight, maxWidth, maxHeight, aspectRatio }),
			[aspectRatio, maxHeight, maxWidth, minHeight, minWidth],
		);
		const dragStart = React.useRef<DragStart | null>(null);
		// The last size reported during the current drag, so `onChangeEnd` gets exactly that.
		const lastReported = React.useRef<ImageSize>(value);
		// Display state only: the address that failed, so a new address tries again.
		const [failedUri, setFailedUri] = React.useState<string | null>(null);
		const showsPicture = uri !== null && uri !== failedUri;
		const source = React.useMemo((): { readonly uri: string } | null => (uri === null ? null : { uri }), [uri]);
		const frameStyle = React.useMemo((): ImageSize => ({ width: value.width, height: value.height }), [value.height, value.width]);
		const spokenSize = sizeText(value);

		const markFailed = React.useCallback((): void => {
			setFailedUri(uri);
		}, [uri]);

		const startDrag = React.useCallback(
			(handle: ImageResizeHandle, event: GestureResponderEvent): void => {
				const { pageX, pageY } = event.nativeEvent;
				dragStart.current = { handle, pageX, pageY, size: value };
				lastReported.current = value;
			},
			[value],
		);
		const moveDrag = React.useCallback(
			(event: GestureResponderEvent): void => {
				const start = dragStart.current;
				if (start === null) {
					return;
				}
				const next = resizeImageByHandle(start.size, start.handle, { x: event.nativeEvent.pageX - start.pageX, y: event.nativeEvent.pageY - start.pageY }, constraints);
				if (!isSameImageSize(next, lastReported.current)) {
					lastReported.current = next;
					onChange(next);
				}
			},
			[constraints, onChange],
		);
		const endDrag = React.useCallback((): void => {
			const start = dragStart.current;
			if (start === null) {
				return;
			}
			dragStart.current = null;
			if (!isSameImageSize(start.size, lastReported.current)) {
				onChangeEnd?.(lastReported.current);
			}
		}, [onChangeEnd]);
		const adjust = React.useCallback(
			(handle: ImageResizeHandle, event: AccessibilityActionEvent): void => {
				const distance = event.nativeEvent.actionName === "increment" ? step : -step;
				const next = nudgeImageSize(value, handle, distance, constraints);
				if (!isSameImageSize(next, value)) {
					lastReported.current = next;
					onChange(next);
					onChangeEnd?.(next);
				}
			},
			[constraints, onChange, onChangeEnd, step, value],
		);

		return (
			<View ref={ref} testID={testID} style={frameStyle} className={cn(imageResizerVariants({ variant, state: disabled ? "disabled" : "default" }), className)}>
				{showsPicture ? (
					<StyledImage
						source={source}
						accessible
						accessibilityLabel={alt}
						contentFit={fit}
						onError={markFailed}
						className="size-full"
						testID={testID === undefined ? undefined : `${testID}-image`}
					/>
				) : (
					<View accessible accessibilityRole="image" accessibilityLabel={alt} className="size-full items-center justify-center">
						<Icon icon={ImageOffIcon} size="xl" colorClassName="accent-muted-foreground" />
					</View>
				)}
				{disabled
					? null
					: handles.map((handle: ImageResizeHandle): React.JSX.Element => (
							<ImageResizerHandle
								key={handle}
								handle={handle}
								label={handleLabel(handle)}
								sizeText={spokenSize}
								size={size}
								onGrant={startDrag}
								onMove={moveDrag}
								onEnd={endDrag}
								onAdjust={adjust}
								testID={testID === undefined ? undefined : `${testID}-${handle}`}
							/>
						))}
			</View>
		);
	}),
);
