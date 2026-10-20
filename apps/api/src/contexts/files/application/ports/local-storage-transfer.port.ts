import type { Readable } from "node:stream";

import type { FileDownloadDisposition, FileVariantKind } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

/** Bytes plus the headers they must be served with. */
export interface LocalObjectDownload {
	readonly stream: Readable;
	readonly mimeType: string;
	readonly disposition: FileDownloadDisposition;
	readonly fileName: string;
}

/**
 * The HTTP side of the development-only local storage driver: it plays the
 * role S3/GCS play for remote providers (§7.8: presentation, driver-only — no
 * command). Every operation is authorized by a signed, expiring capability
 * token bound to one file or, for public assets, by the file row itself —
 * never by a client-supplied path. Every method answers 404 unless the local
 * driver is active.
 */
export interface LocalStorageTransferPort {
	/** A private object for a valid download token whose file is still READY at the same key. */
	download(token: string): Promise<LocalObjectDownload>;

	/** A READY public asset by id (what `publishAsset` links to). */
	downloadPublic(fileId: string): Promise<LocalObjectDownload>;

	/** A published rendition of a READY public file. */
	downloadPublicVariant(fileId: string, kind: FileVariantKind): Promise<LocalObjectDownload>;

	/** The browser's multipart POST for a PENDING file; the token is verified before a single file byte is buffered. */
	upload(fileId: string, request: FastifyRequest): Promise<void>;
}

/**
 * The query parameter a local signed download URL carries its token in. It is
 * the local storage adapter's `LOCAL_DOWNLOAD_TOKEN_PARAM`; a test pins the two
 * together, because presentation may not import the adapter.
 */
export const LOCAL_DOWNLOAD_TOKEN_QUERY_PARAM = "token";

/**
 * Cache-Control for a public asset served by the local driver: the same value
 * the CDN copy is served with (`PUBLIC_ASSET_CACHE_CONTROL`, pinned by a test) —
 * one day, so a withdrawn asset expires from browser caches.
 */
export const LOCAL_PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=86400";
