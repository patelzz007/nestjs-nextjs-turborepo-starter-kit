/**
 * Everything a guide's cover shows, decided from the guide alone: the screenshot behind it, the two tones of
 * its glow and the card in front. Deterministic, so `pnpm docs:covers` redraws the same cover until the guide
 * changes. `scripts/covers.ts` renders the specs (`cover-html.ts`).
 */
import type { ColorTokenName } from "@workspace/tokens";

import { coverDetail, type CoverDetail, type CoverSource } from "./cover-detail";
import { coverScreenshot } from "./cover-screenshot";

/** The tone tokens a cover glows in (`@workspace/tokens`, resolved in the dark theme). */
export const COVER_TONES: readonly ColorTokenName[] = ["tone-blue", "tone-violet", "tone-teal", "tone-green", "tone-orange", "tone-red", "tone-yellow"];

/** Where a guide's cover lives, as its front matter names it. */
export const COVER_URL_FOLDER = "/images/covers/";
export const COVER_EXTENSION = ".webp";

export interface CoverSpec {
	/** The guide's path under `docs/` without `.md`, which is also its cover's (`/images/covers/<slug>.webp`). */
	readonly slug: string;
	/** A README screenshot's name (`docs/images/readme/<name>.webp`). */
	readonly screenshot: string;
	/** The glow's two tones: different tokens from {@link COVER_TONES}. */
	readonly accents: readonly [ColorTokenName, ColorTokenName];
	readonly detail: CoverDetail;
	/** The card's title bar: the guide's file, or the language of its code. */
	readonly label: string;
}

/** Only reached if {@link COVER_TONES} were empty. */
const FALLBACK_TONE: ColorTokenName = "tone-blue";
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** A stable 32-bit FNV-1a hash of `text`. */
export function stableHash(text: string): number {
	let hash = FNV_OFFSET;
	for (const character of text) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
	}
	return hash;
}

/** Two different tones for a guide, chosen by its slug's hash. */
export function coverAccents(slug: string): readonly [ColorTokenName, ColorTokenName] {
	const hash = stableHash(slug);
	const count = COVER_TONES.length;
	const first = hash % count;
	// 1 … count-1 steps on, so the second tone never repeats the first.
	const second = (first + 1 + (Math.floor(hash / count) % (count - 1))) % count;
	return [COVER_TONES.at(first) ?? FALLBACK_TONE, COVER_TONES.at(second) ?? FALLBACK_TONE];
}

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
	typescript: "TypeScript",
	tsx: "TSX",
	javascript: "JavaScript",
	json: "JSON",
	sql: "SQL",
	yaml: "YAML",
	python: "Python",
};

/** The card's title bar: code shows its language, an HTTP request "HTTP", a terminal the shell, the rest the guide's file. */
export function cardLabel(slug: string, detail: CoverDetail): string {
	switch (detail.kind) {
		case "code":
			return LANGUAGE_LABELS[detail.language] ?? detail.language;
		case "http":
			return "HTTP request";
		case "terminal":
			return "Terminal";
		case "diagram":
		case "decision":
		case "outline":
		case "summary":
			return `docs/${slug}.md`;
	}
}

/** A guide's cover. */
export function coverSpec(source: CoverSource): CoverSpec {
	const detail = coverDetail(source);
	return {
		slug: source.slug,
		screenshot: coverScreenshot(source.slug, source.tags),
		accents: coverAccents(source.slug),
		detail,
		label: cardLabel(source.slug, detail),
	};
}

/**
 * The Notion home page's cover (`docs/images/covers/notion-home.webp`, uploaded by `pnpm docs:notion:layout`):
 * the docs home behind the commands that fill that workspace.
 */
export const NOTION_HOME_SPEC: CoverSpec = {
	slug: "notion-home",
	screenshot: "docs-home",
	accents: ["tone-violet", "tone-blue"],
	detail: {
		kind: "terminal",
		lines: [
			{ text: "# the docs, published to Notion", tone: "comment" },
			{ text: "pnpm docs:notion:setup", tone: "command" },
			{ text: "pnpm docs:import --fresh", tone: "command" },
			{ text: "pnpm docs:notion:layout --replace", tone: "command" },
			{ text: "# and edits in Notion, back to the repo", tone: "comment" },
			{ text: "pnpm docs:sync", tone: "command" },
		],
	},
	label: "Terminal",
};

/** The cover URL a guide's front matter must name. */
export function coverUrl(slug: string): string {
	return `${COVER_URL_FOLDER}${slug}${COVER_EXTENSION}`;
}
