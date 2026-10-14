import { Inject, Injectable } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import {
	describeImageDimensionProblem,
	findImageDimensionProblem,
	getFileCategoryPolicy,
	type ImageDimensionProblem,
	type ImageRules,
	type ImageVariantSpec,
	renditionsForWidth,
	type StorageObjectLocator,
} from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { ImageProcessor, type ImageDimensions } from "../../storage/domain/image-processor.port";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import type { PublicDelivery } from "../../storage/domain/public-delivery.port";
import { OBJECT_STORAGE, PUBLIC_DELIVERY } from "../../storage/domain/storage.tokens";
import { buildPublicVariantPath } from "../../storage/utils/file-path.util";
import { legacyBucketFieldsFromLocator, locatorFromFileVariant, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import type { StoredFileVariantInput } from "../repositories/stored-file.repository";
import { resolveStorageOwnerId } from "./file-ownership.util";

/** The uploaded image breaks its category's pixel rules (shape or size). */
export class ImageRulesViolationError extends Error {
	public constructor(
		public readonly problem: ImageDimensionProblem,
		message: string,
	) {
		super(message);
		this.name = "ImageRulesViolationError";
	}
}

/** The image object to read is gone (deleted or never written). */
export class ImageObjectMissingError extends Error {
	public constructor(path: string) {
		super(`Image object ${path} is missing`);
		this.name = "ImageObjectMissingError";
	}
}

/** Renditions are WebP whatever the upload's format. */
const RENDITION_MIME_TYPE = "image/webp";

/**
 * The image half of the file pipeline, for categories with `imageRules`
 * (shared `FILE_CATEGORY_POLICIES`):
 * - on completion, the STORED bytes are decoded and must meet the rules — the
 *   browser's own check is UX only;
 * - on promotion to READY, every rendition the rules list that is no wider than
 *   the original is rendered from it (upright, metadata stripped, exact size),
 *   stored next to it and published, so pages serve a `srcset` and each screen
 *   downloads what it needs — never an upscaled copy that only looks sharper.
 */
@Injectable()
export class ImageRenditionService {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		@Inject(PUBLIC_DELIVERY) private readonly publicDelivery: PublicDelivery,
		private readonly processor: ImageProcessor,
	) {}

	/** The rules a file's category sets for its pixels, or `null` when it has none. */
	public rulesFor(file: Pick<StoredFile, "category">): ImageRules | null {
		return getFileCategoryPolicy(file.category).imageRules ?? null;
	}

	/**
	 * Decodes the stored upload and checks it against its category's rules;
	 * returns its displayed size, or `null` for a category without rules.
	 * Throws {@link ImageRulesViolationError} or `UnreadableImageError`.
	 */
	public async inspectUpload(file: Pick<StoredFile, "category">, locator: StorageObjectLocator): Promise<ImageDimensions | null> {
		const rules = this.rulesFor(file);
		if (rules === null) {
			return null;
		}
		const dimensions = await this.processor.inspect(await this.readBytes(locator));
		const problem = findImageDimensionProblem(dimensions.width, dimensions.height, rules);
		if (problem !== null) {
			throw new ImageRulesViolationError(problem, describeImageDimensionProblem(problem, rules));
		}
		return dimensions;
	}

	/**
	 * Renders, stores and publishes every rendition of a promoted image that its
	 * stored original is wide enough for, from `source` (its final private key).
	 * The width is read from the stored bytes, not the row. The rows are returned
	 * for the verdict transaction; nothing is recorded here. Empty for a category
	 * without rules.
	 *
	 * The renditions are rendered side by side (libvips runs each on its own
	 * threads: a 4K image's five renditions take ~1.7 s instead of ~3.1 s). If
	 * any fails, every rendition already published is withdrawn before the
	 * first failure is rethrown unchanged, so a failed promotion leaves nothing
	 * public behind.
	 */
	public async renderAndPublish(file: StoredFile, source: StorageObjectLocator): Promise<readonly StoredFileVariantInput[]> {
		const rules = this.rulesFor(file);
		if (rules === null) {
			return [];
		}
		const original = await this.readBytes(source);
		const { width } = await this.processor.inspect(original);
		const outcomes = await Promise.all(
			renditionsForWidth(width, rules).map((spec) =>
				this.renderVariant(file, original, source, spec, rules)
					.then((variant) => ({ variant, error: null }))
					.catch((error: unknown) => ({ variant: null, error })),
			),
		);
		const variants = outcomes.flatMap((outcome) => (outcome.variant === null ? [] : [outcome.variant]));
		const failed = outcomes.find((outcome) => outcome.variant === null);
		if (failed !== undefined) {
			await this.discard(variants, file.id);
			throw failed.error;
		}
		return variants;
	}

	/** Renders one rendition, stores it next to the original and publishes it. */
	private async renderVariant(file: StoredFile, original: Buffer, source: StorageObjectLocator, spec: ImageVariantSpec, rules: ImageRules): Promise<StoredFileVariantInput> {
		const height = Math.round((spec.width * rules.aspectHeight) / rules.aspectWidth);
		const rendered = await this.processor.render(original, spec.width, height);
		const path = buildPublicVariantPath({
			category: file.category,
			ownerId: resolveStorageOwnerId(file),
			fileId: file.id,
			fileName: file.originalName,
			mimeType: RENDITION_MIME_TYPE,
			variant: spec.kind,
		});
		const stored = await this.storage.upload({
			locator: toStorageObjectLocator(source.provider, source.container, path),
			buffer: rendered.bytes,
			mimeType: RENDITION_MIME_TYPE,
		});
		const published = await this.publicDelivery.publishAsset({
			locator: stored.locator,
			fileId: file.id,
			mimeType: RENDITION_MIME_TYPE,
			fileName: file.originalName,
			variant: spec.kind,
		});
		return {
			kind: spec.kind,
			mimeType: RENDITION_MIME_TYPE,
			sizeBytes: rendered.bytes.length,
			width: rendered.width,
			height: rendered.height,
			...legacyBucketFieldsFromLocator(stored.locator),
			objectRevision: stored.revision,
			objectGeneration: stored.revision,
			storagePath: stored.locator.path,
			publicPath: published.publicUrl,
		};
	}

	/** Withdraws and deletes renditions that will not be used (the READY transition did not commit). */
	public async discard(variants: readonly StoredFileVariantInput[], fileId: string): Promise<void> {
		for (const variant of variants) {
			const locator = toStorageObjectLocator(variant.storageProvider, variant.storageContainer, variant.storagePath);
			await this.publicDelivery.unpublishAsset({ locator, fileId });
			await this.storage.deleteObject(locator);
		}
	}

	/** Where a recorded rendition lives (for withdrawal when its file is deleted). */
	public locatorOf(variant: Parameters<typeof locatorFromFileVariant>[0]): StorageObjectLocator {
		return locatorFromFileVariant(variant, this.config.storage.provider);
	}

	private async readBytes(locator: StorageObjectLocator): Promise<Buffer> {
		const bytes = await this.storage.getObject(locator);
		if (bytes === null) {
			throw new ImageObjectMissingError(locator.path);
		}
		return bytes;
	}
}
