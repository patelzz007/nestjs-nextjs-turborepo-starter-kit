import { z } from "zod";

import { DocsCollectionSchema, DocsSourceKindSchema } from "./document.ts";
import { parseJson } from "./json.ts";

/**
 * `docs/sync/manifest.json`: which generated file came from which document. It is what makes a sync
 * repeatable and rebuildable, and it lives in the repository, so it only advances when a pull request merges:
 * a sync that fails or never merges can never skip a change (plan §6, invariant 7).
 */

export const MANIFEST_PATH = "docs/sync/manifest.json";
export const REDIRECTS_PATH = "docs/sync/redirects.json";
export const SYNCED_IMAGES_FOLDER = "docs/images/synced";
const MANIFEST_VERSION = 1;
const JSON_INDENT = "\t";

const TextSchema = z.string().min(1);

export const ManifestEntrySchema = z
	.object({
		source: DocsSourceKindSchema,
		sourceId: TextSchema,
		sourceUrl: z.url().nullable(),
		collection: DocsCollectionSchema,
		slug: TextSchema,
		title: TextSchema,
		/** Earlier slugs, oldest first: they become permanent redirects. */
		previousSlugs: z.array(TextSchema),
		section: TextSchema.nullable(),
		order: z.number().int().positive().nullable(),
		filePath: TextSchema,
		/** SHA-256 of the generated file. */
		contentHash: TextSchema,
		converterVersion: z.number().int().nonnegative(),
		editedAt: z.number().int(),
		lastRunId: TextSchema,
		/** The documents this page links to, so a renamed target re-renders it and a linked page cannot quietly vanish. */
		links: z.array(TextSchema),
		/** The synced files this page uses, so one still in use is never deleted. */
		assets: z.array(TextSchema),
	})
	.strict();
export type ManifestEntry = z.output<typeof ManifestEntrySchema>;

/** A page that left the site: its record keeps old links redirecting and answers "where did it go?". */
export const ManifestTombstoneSchema = z
	.object({
		source: DocsSourceKindSchema,
		sourceId: TextSchema,
		collection: DocsCollectionSchema,
		slug: TextSchema,
		lastRunId: TextSchema,
	})
	.strict();
export type ManifestTombstone = z.output<typeof ManifestTombstoneSchema>;

export const ManifestSchema = z
	.object({
		version: z.literal(MANIFEST_VERSION),
		entries: z.array(ManifestEntrySchema),
		tombstones: z.array(ManifestTombstoneSchema),
	})
	.strict();
export type Manifest = z.output<typeof ManifestSchema>;

export const EMPTY_MANIFEST: Manifest = { version: MANIFEST_VERSION, entries: [], tombstones: [] };

/** A manifest that does not match the schema: a workspace-level problem, so the batch stops. */
export class CorruptManifestError extends Error {
	public constructor(detail: string) {
		super(`${MANIFEST_PATH} is corrupt: ${detail}`);
		this.name = "CorruptManifestError";
	}
}

export function parseManifest(text: string): Manifest {
	try {
		return ManifestSchema.parse(parseJson(text));
	} catch (error) {
		throw new CorruptManifestError(error instanceof Error ? error.message : "not a manifest");
	}
}

function byIdentity(left: { readonly sourceId: string }, right: { readonly sourceId: string }): number {
	return left.sourceId < right.sourceId ? -1 : Number(left.sourceId > right.sourceId);
}

/** The manifest as stored: sorted, so the same state always gives the same bytes. */
export function serialiseManifest(manifest: Manifest): string {
	const sorted: Manifest = { ...manifest, entries: [...manifest.entries].sort(byIdentity), tombstones: [...manifest.tombstones].sort(byIdentity) };
	return `${JSON.stringify(sorted, null, JSON_INDENT)}\n`;
}
