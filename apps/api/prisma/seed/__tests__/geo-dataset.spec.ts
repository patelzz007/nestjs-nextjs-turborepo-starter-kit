import { describe, expect, it } from "vitest";

import { GEO_DATASET, geoDatasetUrl, loadGeoDatasetFile, sha256Of, type GeoDatasetIo, type GeoDatasetPin } from "../geo-dataset";

const CACHE_DIR = "/cache/geo-dataset";
const GOOD = Buffer.from('[{"id":1,"name":"Asia"}]');
const PIN: GeoDatasetPin = {
	...GEO_DATASET,
	commit: "0123456789abcdef0123456789abcdef01234567",
	sha256: { ...GEO_DATASET.sha256, regions: sha256Of(GOOD) },
};
const CACHE_PATH = `${CACHE_DIR}/${PIN.commit}/regions.json`;

interface FakeIo extends GeoDatasetIo {
	readonly fetched: string[];
	readonly slept: number[];
	readonly written: Map<string, Buffer>;
}

/** Answers each fetch from `responses` in order: a Buffer is a download, an Error a network failure. */
function fakeIo(responses: readonly (Buffer | Error)[], cached: Buffer | null = null): FakeIo {
	const fetched: string[] = [];
	const slept: number[] = [];
	const written = new Map<string, Buffer>();
	const queue = [...responses];
	return {
		fetched,
		slept,
		written,
		fetchFile: (url: string): Promise<Buffer> => {
			fetched.push(url);
			const next = queue.shift();
			if (next === undefined) {
				return Promise.reject(new Error("no response left"));
			}
			return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
		},
		readCached: (): Promise<Buffer | null> => Promise.resolve(cached),
		writeCached: (path: string, contents: Buffer): Promise<void> => {
			written.set(path, contents);
			return Promise.resolve();
		},
		sleep: (ms: number): Promise<void> => {
			slept.push(ms);
			return Promise.resolve();
		},
		log: (): void => {},
	};
}

describe("the pinned geo dataset", () => {
	it("reads one commit, never a moving branch", () => {
		expect(GEO_DATASET.commit).toMatch(/^[0-9a-f]{40}$/u);
		expect(geoDatasetUrl(GEO_DATASET, "regions")).toBe(`https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/${GEO_DATASET.commit}/json/regions.json`);
		for (const checksum of Object.values(GEO_DATASET.sha256)) {
			expect(checksum).toMatch(/^[0-9a-f]{64}$/u);
		}
	});
});

describe("loadGeoDatasetFile", () => {
	it("uses a cached copy whose checksum matches, without downloading", async () => {
		const io = fakeIo([], GOOD);
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).resolves.toEqual(GOOD);
		expect(io.fetched).toEqual([]);
	});

	it("downloads at the pinned commit, verifies and caches when nothing is cached", async () => {
		const io = fakeIo([GOOD]);
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).resolves.toEqual(GOOD);
		expect(io.fetched).toEqual([geoDatasetUrl(PIN, "regions")]);
		expect(io.written.get(CACHE_PATH)).toEqual(GOOD);
	});

	it("downloads again when the cached copy is truncated or altered", async () => {
		const io = fakeIo([GOOD], Buffer.from('[{"id":1'));
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).resolves.toEqual(GOOD);
		expect(io.fetched).toHaveLength(1);
	});

	it("retries network failures with doubling back-off, then succeeds", async () => {
		const io = fakeIo([new Error("SSL routines: unexpected message"), new Error("terminated"), GOOD]);
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).resolves.toEqual(GOOD);
		expect(io.fetched).toHaveLength(3);
		expect(io.slept).toEqual([1_000, 2_000]);
	});

	it("gives up after five attempts, naming the file and the last error", async () => {
		const io = fakeIo([1, 2, 3, 4, 5].map((attempt: number): Error => new Error(`failure ${String(attempt)}`)));
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).rejects.toThrow(/after 5 attempts: failure 5/u);
		expect(io.slept).toEqual([1_000, 2_000, 4_000, 8_000]);
		expect(io.written.size).toBe(0);
	});

	it("refuses a download whose checksum doesn't match the pin, without retrying or caching it", async () => {
		const io = fakeIo([Buffer.from("[]")]);
		await expect(loadGeoDatasetFile("regions", io, PIN, CACHE_DIR)).rejects.toThrow(/GEO_DATASET pins/u);
		expect(io.fetched).toHaveLength(1);
		expect(io.written.size).toBe(0);
	});
});
