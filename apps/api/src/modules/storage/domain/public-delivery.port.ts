import type { DocumentMimeType, StorageObjectLocator } from "@workspace/shared";

export interface PublicAssetPublicationInput {
	readonly locator: StorageObjectLocator;
	readonly mimeType: DocumentMimeType;
	readonly fileName: string;
}

export interface PublicAssetPublicationResult {
	readonly publicUrl: string;
	readonly revision: string | null;
}

/** Publishes processed public assets with provider-specific stable URLs. */
export interface PublicDelivery {
	publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult>;
}
