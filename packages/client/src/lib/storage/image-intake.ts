import { describeImageDimensionProblem, type ImageRules } from "@workspace/shared";

import { canReachMinimum, exportPreparedImage, hasExactAspect, initialImageCrop, readUprightImage } from "./image-preparation";

// ============================================
// lib/storage/image-intake.ts — what happens to a photo someone picks
// ============================================
// Too small for the rules' minimum even zoomed out to show all of it → refused
// with the API's own words. Already the rules' shape → prepared at once (kept at
// its own size, at most the widest rendition). Any other shape → the person
// chooses the crop first (`ImageCropDialog`).

/** The outcome of reading one picked photo. */
export type ImageIntake =
	| { readonly kind: "refused"; readonly fileName: string; readonly message: string }
	| { readonly kind: "prepared"; readonly file: File }
	| { readonly kind: "needs_crop"; readonly source: File; readonly image: ImageBitmap };

/** Reads a picked photo upright and decides its next step under `rules`. A `needs_crop` image stays open for the cropper. */
export async function takeImage(source: File, rules: ImageRules): Promise<ImageIntake> {
	let image: ImageBitmap;
	try {
		image = await readUprightImage(source);
	} catch {
		return { kind: "refused", fileName: source.name, message: "This file could not be read as an image." };
	}
	if (!canReachMinimum(image.width, image.height, rules)) {
		image.close();
		return { kind: "refused", fileName: source.name, message: describeImageDimensionProblem("too_small", rules) };
	}
	if (hasExactAspect(image.width, image.height, rules)) {
		try {
			const area = initialImageCrop({ width: image.width, height: image.height }, rules);
			return { kind: "prepared", file: await exportPreparedImage(image, area, rules, source.name) };
		} catch (error) {
			return { kind: "refused", fileName: source.name, message: error instanceof Error ? error.message : "The image could not be prepared." };
		} finally {
			image.close();
		}
	}
	return { kind: "needs_crop", source, image };
}
