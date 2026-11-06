/**
 * Byte counts for `pnpm tools bundle:check` (plan §19.6): the gzip size of a Next
 * route's first-load chunks (what the browser downloads), and the raw size of
 * a mobile Hermes bundle read from `expo export`'s `metadata.json`.
 */
import path from "node:path";
import { gzipSync } from "node:zlib";

import { z } from "zod";

/**
 * Gzip size of one file's bytes at zlib's default level (decision #64:
 * `node:zlib`, no new dependency).
 */

export function gzipSize(bytes: Uint8Array): number {
	return gzipSync(bytes).byteLength;
}

/**
 * Sum of the gzip sizes of the unique `files` (each compressed on its own,
 * as each is served on its own).
 */

export async function sumGzipSizes(files: readonly string[], readBytes: (file: string) => Promise<Uint8Array>): Promise<number> {
	const sizes = await Promise.all([...new Set(files)].map(async (file) => gzipSize(await readBytes(file))));
	return sizes.reduce((total, size) => total + size, 0);
}

const ExpoMetadataSchema = z.object({
	fileMetadata: z.record(z.string(), z.object({ bundle: z.string().min(1) })),
});

/**
 * The Hermes bytecode bundle of each platform, from the `metadata.json` that
 * `expo export` writes at the root of its output directory
 * (`fileMetadata.<platform>.bundle`, e.g. `_expo/static/js/ios/index-<hash>.hbc`).
 * Raw bytes: the bundle ships inside the app binary, not gzip-served.
 */

export async function readExpoBundleSizes(
	exportDir: string,
	platforms: readonly string[],
	{ readText, fileSize }: { readText: (file: string) => Promise<string>; fileSize: (file: string) => Promise<number> },
): Promise<Map<string, number>> {
	const { fileMetadata } = ExpoMetadataSchema.parse(JSON.parse(await readText(path.join(exportDir, "metadata.json"))));
	const sizes = new Map<string, number>();
	for (const platform of platforms) {
		const entry = fileMetadata[platform];
		if (entry === undefined) {
			throw new Error(`${exportDir}/metadata.json has no ${platform} bundle — export every platform (\`expo export --platform ios --platform android\`)`);
		}
		sizes.set(platform, await fileSize(path.join(exportDir, entry.bundle)));
	}
	return sizes;
}
