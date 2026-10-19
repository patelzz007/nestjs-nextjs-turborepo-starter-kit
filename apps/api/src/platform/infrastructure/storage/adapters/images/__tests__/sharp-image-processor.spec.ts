import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { UnreadableImageError } from "../../../domain/image-processor.port";
import { SharpImageProcessor } from "../sharp-image-processor";

/** EXIF orientation 6: the camera was turned a quarter clockwise, so the stored pixels are sideways. */
const QUARTER_TURN_ORIENTATION = 6;

function solidJpeg(width: number, height: number, orientation?: number): Promise<Buffer> {
	const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg();
	return (orientation === undefined ? image : image.withMetadata({ orientation })).toBuffer();
}

describe("SharpImageProcessor", () => {
	const processor = new SharpImageProcessor();

	it("reports the size an image is displayed at", async () => {
		await expect(processor.inspect(await solidJpeg(1600, 900))).resolves.toEqual({ width: 1600, height: 900 });
	});

	it("applies a quarter-turn orientation, so a sideways-stored photo reports its upright size", async () => {
		await expect(processor.inspect(await solidJpeg(900, 1600, QUARTER_TURN_ORIENTATION))).resolves.toEqual({ width: 1600, height: 900 });
	});

	it("renders a WebP at exactly the requested size, cropping to fill instead of letterboxing", async () => {
		const rendered = await processor.render(await solidJpeg(1000, 1000), 640, 360);

		expect(rendered).toMatchObject({ width: 640, height: 360, mimeType: "image/webp" });
		const metadata = await sharp(rendered.bytes).metadata();
		expect(metadata).toMatchObject({ format: "webp", width: 640, height: 360 });
		expect(metadata.exif).toBeUndefined();
	});

	it("turns bytes that are not an image into UnreadableImageError", async () => {
		await expect(processor.inspect(Buffer.from("not an image"))).rejects.toBeInstanceOf(UnreadableImageError);
		await expect(processor.render(Buffer.from("not an image"), 640, 360)).rejects.toBeInstanceOf(UnreadableImageError);
	});
});
