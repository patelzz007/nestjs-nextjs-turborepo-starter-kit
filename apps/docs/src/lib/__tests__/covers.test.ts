import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readCoverGuides } from "../covers/cover-guides";
import { coverSpec, coverUrl } from "../covers/cover-spec";

const DOCS_ROOT = fileURLToPath(new URL("../../../../../docs/", import.meta.url));

describe("guide covers", () => {
	const guides = readCoverGuides(DOCS_ROOT);

	it("gives every guide a cover of its own, named after the guide (no two guides share one)", () => {
		expect(guides.length).toBeGreaterThan(0);
		expect(guides.filter(({ slug, cover }) => cover !== coverUrl(slug)).map(({ slug, cover }) => `${slug}: ${String(cover)}`)).toEqual([]);
	});

	it("has every cover's image in docs/images/covers/ (`pnpm docs:covers` draws them)", () => {
		expect(guides.filter(({ slug }) => !existsSync(`${DOCS_ROOT}images/covers/${slug}.webp`)).map(({ slug }) => slug)).toEqual([]);
	});

	it("draws a different card on every guide's cover", () => {
		const seen = new Map<string, string>();
		const repeats = guides.flatMap((guide) => {
			const card = JSON.stringify(coverSpec(guide).detail);
			const first = seen.get(card);
			seen.set(card, guide.slug);
			return first === undefined ? [] : [`${guide.slug} repeats ${first}`];
		});

		expect(repeats).toEqual([]);
	});
});
