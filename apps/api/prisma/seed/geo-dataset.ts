// ============================================
// seed/geo-dataset.ts - The pinned geo dataset and its loader
// ============================================
// The geo seed converges the geo tables to dr5hn/countries-states-cities-database. It reads one PINNED
// commit, never `master`, so every seed (a developer's, CI's) gets the same rows, and bumping the data is
// a deliberate change to GEO_DATASET below (new commit + the new files' SHA-256s).
//
// Each file is downloaded once into a cache folder (`apps/api/.cache/geo-dataset/<commit>/`, gitignored;
// CI caches it between runs), retried with exponential back-off on network errors, and verified by its
// SHA-256 before use. A cached copy is verified too, so a truncated or tampered file is downloaded again.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** The files the geo seed reads (`countries+states+cities` is URL-encoded on the raw host). */
export type GeoDatasetFileName = "regions" | "subregions" | "countries" | "states" | "countries%2Bstates%2Bcities";

export interface GeoDatasetPin {
	readonly repository: string;
	/** The upstream commit every file is read at. */
	readonly commit: string;
	/** Each file's SHA-256 (hex) at that commit. */
	readonly sha256: Readonly<Record<GeoDatasetFileName, string>>;
}

/** Bump together: the commit, then every file's SHA-256 at it (`shasum -a 256 <file>`). */
export const GEO_DATASET: GeoDatasetPin = {
	repository: "dr5hn/countries-states-cities-database",
	commit: "e39d7109a50ad48c24ca18a5baa1bcb7bc67f3e0",
	sha256: {
		regions: "62031692a5c6a32d67f4c76313990519b43410c61b91b533fbd67f897c022734",
		subregions: "9fac6ae43710be328b9fa832c4e0168d8dad6e4f4a56e0dfc0a98b3c19d90dab",
		countries: "43df689ce9303665de103f0643b2b633adb1dca8320bf49db5d1df4b30c3a182",
		states: "9ff8201f31e374ba2a1173cd3203d45fc72a365d87e446d3c66ea9d90bda34c7",
		"countries%2Bstates%2Bcities": "18d71fd1e092735f9eaf4479398ca5afd8d6918fdedd43e3c0aa3b1230c60cb7",
	},
};

/** Where downloaded files are kept between seeds (gitignored; the CI jobs cache this folder). */
export const GEO_DATASET_CACHE_DIR: string = resolve(import.meta.dirname, "../../.cache/geo-dataset");

/** Attempts per file before the seed gives up. */
const DOWNLOAD_ATTEMPTS = 5;
/** First back-off; each later one doubles (1 s, 2 s, 4 s, 8 s). */
const FIRST_BACKOFF_MS = 1_000;
/** One attempt may take this long (the largest file is about 53 MB). */
const ATTEMPT_TIMEOUT_MS = 120_000;

/** What the loader needs from the outside world; replaced in tests. */
export interface GeoDatasetIo {
	readonly fetchFile: (url: string, timeoutMs: number) => Promise<Buffer>;
	readonly readCached: (path: string) => Promise<Buffer | null>;
	/** Writes atomically (temporary file, then rename), so a half-written file is never read. */
	readonly writeCached: (path: string, contents: Buffer) => Promise<void>;
	readonly sleep: (ms: number) => Promise<void>;
	readonly log: (line: string) => void;
}

export function geoDatasetUrl(pin: GeoDatasetPin, file: GeoDatasetFileName): string {
	return `https://raw.githubusercontent.com/${pin.repository}/${pin.commit}/json/${file}.json`;
}

export function sha256Of(contents: Buffer): string {
	return createHash("sha256").update(contents).digest("hex");
}

/**
 * One file of the pinned dataset: the verified cached copy, or a fresh download (retried with back-off),
 * verified and cached. A checksum mismatch is never retried: it means the pin is wrong, not the network.
 */
export async function loadGeoDatasetFile(
	file: GeoDatasetFileName,
	io: GeoDatasetIo,
	pin: GeoDatasetPin = GEO_DATASET,
	cacheDir: string = GEO_DATASET_CACHE_DIR,
): Promise<Buffer> {
	const expected = pin.sha256[file];
	const cachePath = join(cacheDir, pin.commit, `${file}.json`);
	const cached = await io.readCached(cachePath);
	if (cached !== null && sha256Of(cached) === expected) {
		return cached;
	}
	const url = geoDatasetUrl(pin, file);
	const contents = await downloadWithRetry(url, io);
	const actual = sha256Of(contents);
	if (actual !== expected) {
		throw new Error(`${url} has SHA-256 ${actual}, but GEO_DATASET pins ${expected}. Re-pin prisma/seed/geo-dataset.ts if the dataset was bumped on purpose.`);
	}
	await io.writeCached(cachePath, contents);
	return contents;
}

async function downloadWithRetry(url: string, io: GeoDatasetIo): Promise<Buffer> {
	let backoffMs = FIRST_BACKOFF_MS;
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await io.fetchFile(url, ATTEMPT_TIMEOUT_MS);
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : String(error);
			if (attempt >= DOWNLOAD_ATTEMPTS) {
				throw new Error(`Could not download ${url} after ${String(DOWNLOAD_ATTEMPTS)} attempts: ${reason}`);
			}
			io.log(`  ↻ ${url} failed (${reason}); retrying in ${String(backoffMs / FIRST_BACKOFF_MS)} s (attempt ${String(attempt + 1)} of ${String(DOWNLOAD_ATTEMPTS)})`);
			await io.sleep(backoffMs);
			backoffMs *= 2;
		}
	}
}

/** The loader's real world: Node's fetch, the file system and timers. */
export function nodeGeoDatasetIo(log: (line: string) => void): GeoDatasetIo {
	return {
		fetchFile: async (url: string, timeoutMs: number): Promise<Buffer> => {
			const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
			if (!response.ok) {
				throw new Error(`HTTP ${String(response.status)}`);
			}
			return Buffer.from(await response.arrayBuffer());
		},
		readCached: async (path: string): Promise<Buffer | null> => {
			try {
				return await readFile(path);
			} catch {
				return null;
			}
		},
		writeCached: async (path: string, contents: Buffer): Promise<void> => {
			await mkdir(join(path, ".."), { recursive: true });
			const temporary = `${path}.${String(process.pid)}.tmp`;
			await writeFile(temporary, contents);
			await rename(temporary, path);
		},
		sleep: async (ms: number): Promise<void> => {
			await new Promise<void>((done: () => void): void => {
				setTimeout(done, ms);
			});
		},
		log,
	};
}
