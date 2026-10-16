/**
 * Drag-to-resize image geometry — the public surface. Pure TypeScript, so the web kit, the native
 * kit and the docs site resize images with this one implementation (docs/technical/frontend/image-resizer.md).
 */
export {
	clampImageSize,
	DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
	IMAGE_RESIZE_CORNER_HANDLES,
	IMAGE_RESIZE_HANDLES,
	IMAGE_RESIZE_LARGE_STEP_PX,
	IMAGE_RESIZE_STEP_PX,
	imageResizeHandleAxis,
	ImageResizeHandleSchema,
	InvalidImageResizeConstraintsError,
	isImageResizeCornerHandle,
	isSameImageSize,
	nudgeImageSize,
	resizeImageByHandle,
	resolveImageResizeConstraints,
	type ImageResizeConstraints,
	type ImageResizeConstraintsInput,
	type ImageResizeDelta,
	type ImageResizeDirection,
	type ImageResizeHandle,
	type ImageResizeHandleAxis,
	type ImageSize,
} from "./image-resize";
