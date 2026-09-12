import type { StoredFile } from "@prisma/client";
import { StorageObjectLocatorSchema, StorageProviderSchema, type StorageObjectLocator, type StorageProvider } from "@workspace/shared";

export function inferStorageProviderFromContainer(container: string): StorageProvider {
	if (container.startsWith("local-")) {
		return "local";
	}
	return "s3";
}

export function toStorageObjectLocator(provider: StorageProvider, container: string, path: string, revision?: string | null): StorageObjectLocator {
	return StorageObjectLocatorSchema.parse({
		provider,
		container,
		path,
		revision: revision ?? null,
	});
}

/** Read neutral columns first, then fall back to legacy bucket/generation fields. */
export function locatorFromStoredFile(file: StoredFile, activeProvider: StorageProvider): StorageObjectLocator {
	const providerValue = file.storageProvider ?? inferStorageProviderFromContainer(file.storageContainer ?? file.storageBucket);
	const provider = StorageProviderSchema.parse(providerValue);
	if (provider !== activeProvider) {
		throw new Error(`File ${file.id} is stored on provider "${provider}" but active provider is "${activeProvider}"`);
	}
	return StorageObjectLocatorSchema.parse({
		provider,
		container: file.storageContainer ?? file.storageBucket,
		path: file.storagePath,
		revision: file.objectRevision ?? file.objectGeneration ?? null,
	});
}

export function legacyBucketFieldsFromLocator(locator: StorageObjectLocator): {
	readonly storageBucket: string;
	readonly objectGeneration: string | null;
	readonly storageProvider: StorageProvider;
	readonly storageContainer: string;
	readonly objectRevision: string | null;
} {
	return {
		storageBucket: locator.container,
		objectGeneration: locator.revision ?? null,
		storageProvider: locator.provider,
		storageContainer: locator.container,
		objectRevision: locator.revision ?? null,
	};
}
