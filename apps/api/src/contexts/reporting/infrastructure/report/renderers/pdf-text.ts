// ============================================
// pdf-text.ts — every string of the PDF report is drawn through here
// ============================================
// PDFKit draws a string in ONE font. A report mixes scripts (an English label
// next to a Tamil reward title, a Chinese merchant name), so each string is
// split into script runs (`ReportFontRegistry.segment`) and each run is
// measured and drawn in its own font on one shared alphabetic baseline.
// Shaping (Tamil and Devanagari conjuncts, vowel-sign reordering) is done by
// fontkit inside PDFKit, per run.

import type PDFDocument from "pdfkit";

import { FALLBACK_FONT_KEY, type ReportFontWeight } from "../fonts/report-fonts";
import { reportFontName, type ReportFontRegistry } from "../fonts/report-font-registry";

type PdfDocument = InstanceType<typeof PDFDocument>;

/** Appended to text cut to fit a width. */
const ELLIPSIS = "…";

/** Baseline position within a line box, as a share of the font size (Noto Sans ascender). */
const BASELINE_RATIO = 1.069;
/** Line box height as a share of the font size. */
const LINE_HEIGHT_RATIO = 1.362;

/** Characters that would break a single drawn line. */
const LINE_BREAKS = /[\r\n\t\v\f\u2028\u2029]+/g;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** How one string is drawn. */
export interface PdfTextStyle {
	readonly size: number;
	readonly weight: ReportFontWeight;
	readonly color: string;
}

/** Where it goes: a box `width` wide starting at `x`; aligned in it, cut with "…" when it does not fit. */
export interface PdfTextBox {
	readonly width: number;
	readonly align: "left" | "center" | "right";
}

/** Draws and measures mixed-script text on one PDF document. */
export class PdfText {
	public constructor(
		private readonly doc: PdfDocument,
		private readonly fonts: ReportFontRegistry,
	) {
		for (const face of fonts.allFaces()) {
			doc.registerFont(face.name, face.bytes);
		}
		doc.font(reportFontName(FALLBACK_FONT_KEY, "regular"));
	}

	/** Height of one line of text at `size`. */
	public lineHeight(size: number): number {
		return size * LINE_HEIGHT_RATIO;
	}

	/** Width of `text` drawn at `size` / `weight`, summed over its script runs. */
	public width(text: string, size: number, weight: ReportFontWeight): number {
		return this.fonts.segment(text).reduce((total, run) => total + this.runWidth(run.text, run.fontKey, size, weight), 0);
	}

	/**
	 * Draws `text` on one line whose box starts at (`x`, `top`). With a `box`,
	 * it is aligned in the box and cut (on a grapheme boundary, with "…") to fit.
	 */
	public draw(text: string, x: number, top: number, style: PdfTextStyle, box?: PdfTextBox): void {
		// One line: line breaks and tabs inside a value (a multi-line reward title) read as spaces.
		const oneLine = text.replace(LINE_BREAKS, " ");
		const fitted = box === undefined ? oneLine : this.fit(oneLine, box.width, style);
		const width = this.width(fitted, style.size, style.weight);
		let cursor = x;
		if (box?.align === "right") cursor = x + box.width - width;
		if (box?.align === "center") cursor = x + (box.width - width) / 2;
		const baseline = top + style.size * BASELINE_RATIO;
		this.doc.fillColor(style.color);
		for (const run of this.fonts.segment(fitted)) {
			this.doc.font(reportFontName(run.fontKey, style.weight)).fontSize(style.size).text(run.text, cursor, baseline, { lineBreak: false, baseline: "alphabetic" });
			cursor += this.runWidth(run.text, run.fontKey, style.size, style.weight);
		}
	}

	/** `text`, or its longest grapheme prefix + "…" that fits `width`. */
	public fit(text: string, width: number, style: PdfTextStyle): string {
		if (this.width(text, style.size, style.weight) <= width) {
			return text;
		}
		const clusters = [...graphemes.segment(text)].map((segment) => segment.segment);
		for (let count = clusters.length - 1; count > 0; count -= 1) {
			const candidate = `${clusters.slice(0, count).join("").trimEnd()}${ELLIPSIS}`;
			if (this.width(candidate, style.size, style.weight) <= width) {
				return candidate;
			}
		}
		return ELLIPSIS;
	}

	private runWidth(text: string, fontKey: string, size: number, weight: ReportFontWeight): number {
		return this.doc.font(reportFontName(fontKey, weight)).fontSize(size).widthOfString(text);
	}
}
