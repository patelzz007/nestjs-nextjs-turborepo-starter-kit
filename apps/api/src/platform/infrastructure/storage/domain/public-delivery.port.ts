import type { DocumentMimeType, FileVariantKind, StorageObjectLocator } from "@workspace/shared";

export interface PublicAssetPublicationInput {
	/** The promoted (final-key) object in the private container. */
	readonly locator: StorageObjectLocator;
	/** Stored file being published (the local driver serves public assets by file id, never by raw path). */
	readonly fileId: string;
	readonly mimeType: DocumentMimeType;
	readonly fileName: string;
	/** The rendition being published (an image variant at its own key); absent for the file itself. */
	readonly variant?: FileVariantKind | undefined;
}

export interface PublicAssetPublicationResult {
	/**
	 * What is stored as the asset's `publicPath`: an absolute CDN / bucket URL,
	 * or — the local driver — a path on this API, joined to the API's public
	 * address only when served (`PublicUrlResolver`), so it survives an address change.
	 */
	readonly publicUrl: string;
	readonly revision: string | null;
}

export interface PublicAssetWithdrawalInput {
	/** The private-container object the asset was published from. */
	readonly locator: StorageObjectLocator;
	readonly fileId: string;
}

export interface PublicAssetWithdrawalResult {
	/**
	 * Object keys a CDN may still serve from its cache (S3: the CloudFront
	 * origin key). The caller purges them through a retried background job;
	 * empty when the provider has no CDN cache (local, Firebase).
	 */
	readonly cachedObjectKeys: readonly string[];
}

/**
 * Publishes processed public assets with provider-specific stable URLs, and
 * withdraws them again. A provider may serve the private object directly (local:
 * by file id; Firebase: by download token) or publish a copy to a separate
 * delivery origin (S3: the CloudFront public-origin bucket) — callers never
 * need to know which.
 */
export interface PublicDelivery {
	publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult>;
	/**
	 * Stops serving a published asset (its file was deleted, or its READY
	 * transition did not commit). Idempotent: withdrawing an asset that is not
	 * published succeeds. The private original is untouched.
	 */
	unpublishAsset(input: PublicAssetWithdrawalInput): Promise<PublicAssetWithdrawalResult>;
}

/**
 * Cache policy of published public assets, on every provider (the CDN copy on
 * S3, the local driver's `local-public` route). Keys are unique per file (they
 * embed the file id). A withdrawn asset is invalidated at the CDN, but browsers
 * that already fetched it keep their copy until this expires, so it is bounded
 * to one day rather than marked immutable.
 */
export const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=86400";
