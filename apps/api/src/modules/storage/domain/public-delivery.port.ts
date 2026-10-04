import type { DocumentMimeType, StorageObjectLocator } from "@workspace/shared";

export interface PublicAssetPublicationInput {
	/** The promoted (final-key) object in the private container. */
	readonly locator: StorageObjectLocator;
	/** Stored file being published (the local driver serves public assets by file id, never by raw path). */
	readonly fileId: string;
	readonly mimeType: DocumentMimeType;
	readonly fileName: string;
}

export interface PublicAssetPublicationResult {
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
