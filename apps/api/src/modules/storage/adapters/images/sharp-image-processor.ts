import sharp, { type Sharp } from "sharp";

import { ImageProcessor, UnreadableImageError, type ImageDimensions, type RenderedImage } from "../../domain/image-processor.port";

/**
 * Refuses decompression bombs: the largest image decoded, in pixels (an 8K
 * 7680×4320 photo is ~33 megapixels; this leaves room for larger camera files).
 */
const MAX_INPUT_PIXELS = 100_000_000;

/** EXIF orientations 5–8 rotate the stored pixels by 90°, swapping the displayed width and height. */
const FIRST_QUARTER_TURN_ORIENTATION = 5;

/**
 * WebP quality of the renditions: high enough that a downscaled photo shows no
 * visible artefacts on a 4K screen, at roughly a third of a JPEG's size.
 */
const RENDITION_WEBP_QUALITY = 85;

/** WebP encoder effort (0–6): slower encode, smaller file at the same quality — renditions are made once. */
const RENDITION_WEBP_EFFORT = 5;

/**
 * libvips through sharp. Downscaling uses the Lanczos-3 kernel (sharp's
 * default), which keeps edges crisp; every rendition is re-encoded, so no
 * EXIF/GPS metadata from the merchant's camera is ever published. Stateless —
 * `StorageModule` provides one instance through a factory.
 */
export class SharpImageProcessor extends ImageProcessor {
	public async inspect(bytes: Buffer): Promise<ImageDimensions> {
		try {
			const metadata = await this.open(bytes).metadata();
			const quarterTurned = (metadata.orientation ?? 1) >= FIRST_QUARTER_TURN_ORIENTATION;
			return quarterTurned ? { width: metadata.height, height: metadata.width } : { width: metadata.width, height: metadata.height };
		} catch (error) {
			throw new UnreadableImageError({ cause: error });
		}
	}

	public async render(bytes: Buffer, width: number, height: number): Promise<RenderedImage> {
		try {
			const { data, info } = await this.open(bytes)
				.rotate()
				.resize(width, height, { fit: "cover", position: "centre", kernel: "lanczos3" })
				.webp({ quality: RENDITION_WEBP_QUALITY, effort: RENDITION_WEBP_EFFORT, smartSubsample: true })
				.toBuffer({ resolveWithObject: true });
			return { bytes: data, width: info.width, height: info.height, mimeType: "image/webp" };
		} catch (error) {
			throw new UnreadableImageError({ cause: error });
		}
	}

	private open(bytes: Buffer): Sharp {
		return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
	}
}
