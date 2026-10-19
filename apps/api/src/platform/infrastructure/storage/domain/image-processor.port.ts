/** An image's size as it is displayed (orientation metadata already applied). */
export interface ImageDimensions {
	readonly width: number;
	readonly height: number;
}

/** One rendition: WebP bytes at exactly the requested size. */
export interface RenderedImage {
	readonly bytes: Buffer;
	readonly width: number;
	readonly height: number;
	readonly mimeType: "image/webp";
}

/** The bytes are not an image the processor can decode (corrupt, truncated, or beyond the pixel limit). */
export class UnreadableImageError extends Error {
	/** `options.cause`: the decoder's own error, kept for logs. */
	public constructor(options?: ErrorOptions) {
		super("The image could not be read", options);
		this.name = "UnreadableImageError";
	}
}

/**
 * Reads and renders raster images for the upload pipeline. Behind a port, like
 * object storage and the malware scanner, so the image library is an adapter
 * detail (today: sharp / libvips) and tests can use a fake.
 */
export abstract class ImageProcessor {
	/** The displayed size of an image; throws {@link UnreadableImageError}. */
	public abstract inspect(bytes: Buffer): Promise<ImageDimensions>;

	/**
	 * Renders the image upright (orientation applied, metadata stripped), scaled
	 * and centre-cropped to exactly `width` × `height`; throws {@link UnreadableImageError}.
	 */
	public abstract render(bytes: Buffer, width: number, height: number): Promise<RenderedImage>;
}
