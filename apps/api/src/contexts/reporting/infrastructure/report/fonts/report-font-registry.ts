import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { create, type Font } from "fontkit";

import {
	FALLBACK_FONT_KEY,
	familyForCodePoint,
	REPORT_FONT_FAMILIES,
	REPORT_FONT_WEIGHTS,
	segmentByScript,
	type ReportFontFamily,
	type ReportFontWeight,
	type ScriptRun,
} from "./report-fonts";

/** A bundled font file (or its licence) is missing or unreadable — the API refuses to start. */
export class ReportFontMissingError extends Error {
	public constructor(path: string, cause: Error) {
		super(`Report font file missing or unreadable: ${path} (PDF exports need the bundled Noto fonts — apps/api/assets/fonts, emitted next to dist/main.js by the build)`, {
			cause,
		});
		this.name = "ReportFontMissingError";
	}
}

/** A font file is not the font the registry expects (wrong family, a collection, or missing glyphs). */
export class ReportFontInvalidError extends Error {
	public constructor(path: string, reason: string) {
		super(`Report font file ${path} is invalid: ${reason}`);
		this.name = "ReportFontInvalidError";
	}
}

/** One loaded font face: its PDFKit name and bytes. */
export interface LoadedReportFontFace {
	readonly name: string;
	readonly fontKey: string;
	readonly weight: ReportFontWeight;
	readonly bytes: Buffer;
}

function readOrFail(path: string): Buffer {
	try {
		return readFileSync(path);
	} catch (error) {
		throw new ReportFontMissingError(path, error instanceof Error ? error : new Error(String(error)));
	}
}

/** The PDFKit font name of a family's weight (`tamil-bold`). */
export function reportFontName(fontKey: string, weight: ReportFontWeight): string {
	return `${fontKey}-${weight}`;
}

/**
 * The report fonts of one export, loaded and validated when built (a missing
 * or wrong file fails that export with a clear error, never a broken PDF):
 * each file exists, parses as a single font of the expected family and can
 * draw its sample text; each licence is present. Provides the per-script text
 * segmentation the PDF renderer draws every string with. Built by
 * {@link ReportFontLoader}.
 */
export class ReportFontRegistry {
	private readonly faces: readonly LoadedReportFontFace[];
	/** Parsed regular faces, for glyph coverage of neutral characters. */
	private readonly coverage: ReadonlyMap<string, Font>;

	public constructor(private readonly families: readonly ReportFontFamily[] = REPORT_FONT_FAMILIES) {
		if (!families.some((family) => family.key === FALLBACK_FONT_KEY)) {
			throw new ReportFontInvalidError("report font families", `no "${FALLBACK_FONT_KEY}" fallback family is registered`);
		}
		const faces: LoadedReportFontFace[] = [];
		const coverage = new Map<string, Font>();
		for (const family of families) {
			readOrFail(fileURLToPath(family.licenceUrl));
			for (const weight of REPORT_FONT_WEIGHTS) {
				const path = fileURLToPath(family.files[weight].url);
				const bytes = readOrFail(path);
				const font = this.parse(path, bytes, family);
				faces.push({ name: reportFontName(family.key, weight), fontKey: family.key, weight, bytes });
				if (weight === "regular") {
					coverage.set(family.key, font);
				}
			}
		}
		this.faces = faces;
		this.coverage = coverage;
	}

	/** Every face to register with a PDF document. */
	public allFaces(): readonly LoadedReportFontFace[] {
		return this.faces;
	}

	/** `text` split into runs, each with the font family that can draw it. */
	public segment(text: string): ScriptRun[] {
		return segmentByScript(
			text,
			(codePoint) => familyForCodePoint(this.families, codePoint),
			(fontKey, codePoint) => this.coverage.get(fontKey)?.hasGlyphForCodePoint(codePoint) ?? false,
		);
	}

	private parse(path: string, bytes: Buffer, family: ReportFontFamily): Font {
		let parsed: ReturnType<typeof create>;
		try {
			parsed = create(bytes);
		} catch (error) {
			throw new ReportFontInvalidError(path, error instanceof Error ? error.message : String(error));
		}
		if ("fonts" in parsed) {
			throw new ReportFontInvalidError(path, "a font collection, expected a single font");
		}
		if (parsed.familyName !== family.familyName) {
			throw new ReportFontInvalidError(path, `family "${parsed.familyName}", expected "${family.familyName}"`);
		}
		const missing = Array.from(family.sampleText).filter((character) => !/\s/u.test(character) && !parsed.hasGlyphForCodePoint(character.codePointAt(0) ?? 0));
		if (missing.length > 0) {
			throw new ReportFontInvalidError(path, `no glyph for ${missing.join(" ")}`);
		}
		return parsed;
	}
}

/**
 * Loads the report fonts for one PDF export, on first use and every time (ADR 059): the API boots
 * without parsing them, and no parsed font is kept between exports — the export rate limit bounds how
 * often the parse runs. Provided through a factory (`REPORT_FONT_LOADER_PROVIDER`), so its constructor
 * argument is a plain value, not injected.
 */
export class ReportFontLoader {
	public constructor(private readonly families: readonly ReportFontFamily[] = REPORT_FONT_FAMILIES) {}

	public load(): ReportFontRegistry {
		return new ReportFontRegistry(this.families);
	}
}

/** Nest provider of the {@link ReportFontLoader} (it loads nothing until an export asks). */
export const REPORT_FONT_LOADER_PROVIDER = {
	provide: ReportFontLoader,
	useFactory: (): ReportFontLoader => new ReportFontLoader(),
};
