import type { StorageObjectLocator } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FakeImageProcessor, FILE_ID, InMemoryObjectStorage, ORG_ID, imageRenditionsFor, storedFile } from "../../../../../../test/support/file-lifecycle-fakes";
import { UnreadableImageError, type RenderedImage } from "../../../../../platform/infrastructure/storage/domain/image-processor.port";
import { ImageObjectMissingError, ImageRulesViolationError } from "../image-rendition.service";

const SOURCE: StorageObjectLocator = { provider: "local", container: "private", path: `stores/${ORG_ID}/reward-images/${FILE_ID}.webp` };

function rewardImage(): ReturnType<typeof storedFile> {
	return storedFile({ category: "REWARD_IMAGE", visibility: "PUBLIC", mimeType: "image/webp", originalName: "kuih.webp", organizationId: ORG_ID });
}

function setup(processor: FakeImageProcessor = new FakeImageProcessor()): {
	readonly storage: InMemoryObjectStorage;
	readonly processor: FakeImageProcessor;
	readonly service: ReturnType<typeof imageRenditionsFor>;
} {
	const storage = new InMemoryObjectStorage();
	storage.put(SOURCE, Buffer.from("original 4K image"));
	return { storage, processor, service: imageRenditionsFor(storage, processor) };
}

/** Renders like the fake, except the rendition of one width fails as a corrupt image would. */
class FailingWidthProcessor extends FakeImageProcessor {
	public constructor(private readonly failingWidth: number) {
		super();
	}

	public override render(bytes: Buffer, width: number, height: number): Promise<RenderedImage> {
		return width === this.failingWidth ? Promise.reject(new UnreadableImageError({ cause: new Error("corrupt tile") })) : super.render(bytes, width, height);
	}
}

describe("ImageRenditionService", () => {
	it("only applies to categories with pixel rules", async () => {
		const { service, processor } = setup();
		const banner = storedFile({ category: "STORE_BANNER" });

		expect(service.rulesFor(banner)).toBeNull();
		await expect(service.inspectUpload(banner, SOURCE)).resolves.toBeNull();
		await expect(service.renderAndPublish(banner, SOURCE)).resolves.toEqual([]);
		expect(processor.rendered).toEqual([]);
	});

	it("holds an avatar to its square rules and renders its square renditions", async () => {
		const { service, processor } = setup();
		const avatar = storedFile({ category: "USER_AVATAR", visibility: "PUBLIC", mimeType: "image/webp", originalName: "me.webp" });

		processor.dimensions = { width: 3840, height: 2160 };
		await expect(service.inspectUpload(avatar, SOURCE)).rejects.toThrow(new ImageRulesViolationError("aspect_ratio", "Images must be 1:1 (square)."));
		processor.dimensions = { width: 512, height: 512 };
		await expect(service.inspectUpload(avatar, SOURCE)).resolves.toEqual({ width: 512, height: 512 });

		const variants = await service.renderAndPublish(avatar, SOURCE);
		expect(variants.map((variant) => [variant.kind, variant.width, variant.height])).toEqual([
			["THUMBNAIL", 128, 128],
			["MEDIUM", 256, 256],
			["LARGE", 512, 512],
		]);
	});

	it("accepts a stored 16:9 4K upload and reports its size", async () => {
		const { service } = setup();

		await expect(service.inspectUpload(rewardImage(), SOURCE)).resolves.toEqual({ width: 3840, height: 2160 });
	});

	it("accepts a Full HD upload, the smallest the rules allow", async () => {
		const { service, processor } = setup();
		processor.dimensions = { width: 1920, height: 1080 };

		await expect(service.inspectUpload(rewardImage(), SOURCE)).resolves.toEqual({ width: 1920, height: 1080 });
	});

	it("refuses an upload that is too small or not 16:9, in the shared words", async () => {
		const { service, processor } = setup();

		processor.dimensions = { width: 1280, height: 720 };
		await expect(service.inspectUpload(rewardImage(), SOURCE)).rejects.toThrow(
			new ImageRulesViolationError("too_small", "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen."),
		);
		processor.dimensions = { width: 4032, height: 3024 };
		await expect(service.inspectUpload(rewardImage(), SOURCE)).rejects.toMatchObject({ problem: "aspect_ratio" });
	});

	it("reports an upload whose object is gone", async () => {
		const { service } = setup();

		await expect(service.inspectUpload(rewardImage(), { ...SOURCE, path: "missing.webp" })).rejects.toBeInstanceOf(ImageObjectMissingError);
	});

	it("renders, stores and publishes every rendition at its exact 16:9 size, in the policy's order", async () => {
		const { service, storage, processor } = setup();

		const variants = await service.renderAndPublish(rewardImage(), SOURCE);

		expect(variants.map((variant) => [variant.kind, variant.width, variant.height])).toEqual([
			["THUMBNAIL", 640, 360],
			["MEDIUM", 1280, 720],
			["LARGE", 1920, 1080],
			["XLARGE", 2560, 1440],
			["UHD", 3840, 2160],
		]);
		expect(processor.rendered).toHaveLength(5);
		for (const variant of variants) {
			expect(variant.mimeType).toBe("image/webp");
			expect(variant.locator.path).toBe(`stores/${ORG_ID}/reward-images/${variant.kind.toLowerCase()}/${FILE_ID}.webp`);
			expect(storage.has(SOURCE.container, variant.locator.path)).toBe(true);
			expect(variant.publicPath).toBe(`https://cdn.test/${FILE_ID}`);
		}
	});

	it("renders only the renditions the original is wide enough for, never an upscaled one", async () => {
		const { service, processor } = setup();
		processor.dimensions = { width: 1920, height: 1080 };

		const variants = await service.renderAndPublish(rewardImage(), SOURCE);

		expect(variants.map((variant) => [variant.kind, variant.width, variant.height])).toEqual([
			["THUMBNAIL", 640, 360],
			["MEDIUM", 1280, 720],
			["LARGE", 1920, 1080],
		]);
		expect(processor.rendered).toEqual([
			{ width: 640, height: 360 },
			{ width: 1280, height: 720 },
			{ width: 1920, height: 1080 },
		]);
	});

	it("stops at the widest rendition that fits an original between two rendition widths", async () => {
		const { service, processor } = setup();
		processor.dimensions = { width: 3200, height: 1800 };

		const variants = await service.renderAndPublish(rewardImage(), SOURCE);

		expect(variants.map((variant) => variant.kind)).toEqual(["THUMBNAIL", "MEDIUM", "LARGE", "XLARGE"]);
	});

	it("withdraws every rendition already made when one fails, and rethrows that failure unchanged", async () => {
		const { service, storage } = setup(new FailingWidthProcessor(2560));

		await expect(service.renderAndPublish(rewardImage(), SOURCE)).rejects.toBeInstanceOf(UnreadableImageError);

		const renditionKeys = ["thumbnail", "medium", "large", "uhd"].map((kind) => `${SOURCE.container}/stores/${ORG_ID}/reward-images/${kind}/${FILE_ID}.webp`);
		expect([...storage.deleted].sort()).toEqual([...renditionKeys].sort());
		expect([...storage.objects.keys()]).toEqual([`${SOURCE.container}/${SOURCE.path}`]);
		expect(storage.unpublished).toHaveLength(4);
	});

	it("discards recorded renditions: withdrawn from delivery, then deleted", async () => {
		const { service, storage } = setup();
		const variants = await service.renderAndPublish(rewardImage(), SOURCE);

		await service.discard(variants, FILE_ID);

		expect(storage.unpublished).toHaveLength(variants.length);
		expect([...storage.objects.keys()]).toEqual([`${SOURCE.container}/${SOURCE.path}`]);
	});
});
