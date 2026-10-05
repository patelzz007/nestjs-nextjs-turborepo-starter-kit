import { PassThrough, type Readable } from "node:stream";

import { Injectable } from "@nestjs/common";
import { assertNever, localDateInTimeZone, PLATFORM_DISPLAY_REGION, type AnalyticsExportFormat, type AnalyticsInterval } from "@workspace/shared";
import PDFDocument from "pdfkit";

import type { AnalyticsReport, AnalyticsReportCell, AnalyticsReportColumn, AnalyticsReportKpi, AnalyticsReportTable } from "../analytics-report";
import {
	ANALYTICS_INTERVAL_LABELS,
	formatChange,
	formatCount,
	formatMoney,
	formatPercent,
	formatRange,
	formatTimestampUtc,
	formatUnitValue,
	minorToMajor,
} from "../report-format";
import type { AnalyticsReportRenderer } from "./analytics-report-renderer";
import { drawChart, type ChartCanvas, type ChartStyle } from "./pdf-chart";
import { PdfText, type PdfTextBox, type PdfTextStyle } from "./pdf-text";
import { ReportFontRegistry } from "../fonts/report-font-registry";
import type { ReportFontWeight } from "../fonts/report-fonts";

/** A4 portrait, in points. */
const PAGE_SIZE = "A4";
const PAGE_MARGIN = 48;

/** Brand palette of the document. */
const COLORS = {
	brand: "#4F46E5",
	text: "#111827",
	muted: "#6B7280",
	rule: "#E5E7EB",
	headerFill: "#F3F4F6",
	zebraFill: "#FAFAFA",
	positive: "#047857",
	negative: "#B91C1C",
	axis: "#9CA3AF",
	grid: "#E5E7EB",
};

/** Series colours of a chart (indigo, amber, teal, rose). */
const CHART_PALETTE: readonly string[] = ["#4F46E5", "#D97706", "#0D9488", "#E11D48"];

/** Typography (points). */
const BRAND_FONT_SIZE = 10;
const TITLE_FONT_SIZE = 20;
const SUBTITLE_FONT_SIZE = 12;
const META_FONT_SIZE = 9;
const SECTION_FONT_SIZE = 13;
const KPI_LABEL_FONT_SIZE = 8;
const KPI_VALUE_FONT_SIZE = 14;
const KPI_CHANGE_FONT_SIZE = 7;
const TABLE_FONT_SIZE = 8;
const FOOTER_FONT_SIZE = 7;

/** Layout (points). */
const KPI_COLUMNS = 4;
const KPI_CARD_HEIGHT = 56;
const KPI_GAP = 8;
const KPI_PADDING = 8;
const CHART_HEIGHT = 170;
const SECTION_GAP = 18;
const TABLE_ROW_HEIGHT = 16;
const TABLE_CELL_PADDING = 4;
const TABLE_TEXT_OFFSET = 4;
const FIXED_COLUMN_WIDTH = 72;
const NARROW_COLUMN_WIDTH = 52;
const MIN_TEXT_COLUMN_WIDTH = 90;
const FOOTER_OFFSET = 20;
const BAND_HEIGHT = 4;
/** Space after a header line (points). */
const LINE_GAP = 4;
/** Offsets of the value and the change line below the KPI label. */
const KPI_VALUE_OFFSET = 12;
const KPI_CHANGE_OFFSET = 32;

const BUCKET_LABEL_OPTIONS: Readonly<Record<AnalyticsInterval, Intl.DateTimeFormatOptions>> = {
	day: { day: "numeric", month: "short" },
	week: { day: "numeric", month: "short" },
	month: { month: "short", year: "numeric" },
};

/** A bucket start as an axis label in the report's zone ("7 Sep", "Sep 2026"). */
function bucketLabel(start: number, interval: AnalyticsInterval, timeZone: string): string {
	return new Intl.DateTimeFormat(PLATFORM_DISPLAY_REGION.locale, { ...BUCKET_LABEL_OPTIONS[interval], timeZone }).format(start);
}

const compactFormatter = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { notation: "compact", maximumFractionDigits: 1 });

type PdfDocument = InstanceType<typeof PDFDocument>;

/**
 * PDFKit's document as the chart drawer's canvas. Text goes through
 * {@link PdfText} (per-script fonts) with the colour and size the chart set last.
 */
function canvasOf(doc: PdfDocument, text: PdfText): ChartCanvas {
	let fillColor = COLORS.text;
	let fontSize = TABLE_FONT_SIZE;
	return {
		moveTo: (x, y): void => {
			doc.moveTo(x, y);
		},
		lineTo: (x, y): void => {
			doc.lineTo(x, y);
		},
		rect: (x, y, width, height): void => {
			doc.rect(x, y, width, height);
		},
		circle: (x, y, radius): void => {
			doc.circle(x, y, radius);
		},
		stroke: (): void => {
			doc.stroke();
		},
		fill: (): void => {
			doc.fill();
		},
		lineWidth: (width): void => {
			doc.lineWidth(width);
		},
		strokeColor: (color): void => {
			doc.strokeColor(color);
		},
		fillColor: (color): void => {
			fillColor = color;
			doc.fillColor(color);
		},
		fontSize: (size): void => {
			fontSize = size;
		},
		text: (value, x, y, options): void => {
			text.draw(value, x, y, { size: fontSize, weight: "regular", color: fillColor }, { width: options.width, align: options.align });
		},
	};
}

/**
 * PDF export (PDFKit, streamed): a branded header with the subject, range,
 * time zone and interval; the KPI cards with their change vs the previous
 * range; vector charts of the main series (drawn by `pdf-chart.ts`); then
 * every table, paginated with its header row repeated on each new page, and
 * a "page n of m" footer.
 */
@Injectable()
export class PdfAnalyticsReportRenderer implements AnalyticsReportRenderer {
	public readonly format: AnalyticsExportFormat = "pdf";

	public constructor(private readonly fonts: ReportFontRegistry) {}

	public render(report: AnalyticsReport): Readable {
		const doc = new PDFDocument({
			size: PAGE_SIZE,
			margin: PAGE_MARGIN,
			bufferPages: true,
			info: {
				Title: `${report.title} — ${report.subjectName}`,
				Author: report.brand,
				Subject: formatRange(report.range),
				CreationDate: new Date(report.generatedAt),
			},
		});
		const output = new PassThrough();
		doc.on("error", (error: Error) => {
			output.destroy(error);
		});
		doc.pipe(output);
		new PdfReportLayout(doc, new PdfText(doc, this.fonts), report).draw();
		doc.end();
		return output;
	}
}

/** Lays one report out on one document, top to bottom. */
class PdfReportLayout {
	/** Top of the next thing drawn on the current page. */
	private y = PAGE_MARGIN;

	public constructor(
		private readonly doc: PdfDocument,
		private readonly text: PdfText,
		private readonly report: AnalyticsReport,
	) {}

	public draw(): void {
		this.drawHeader();
		this.drawKpis();
		for (const chart of this.report.charts) {
			this.ensureSpace(CHART_HEIGHT + SECTION_GAP);
			drawChart(canvasOf(this.doc, this.text), { x: PAGE_MARGIN, y: this.y, width: this.contentWidth(), height: CHART_HEIGHT }, chart, this.chartStyle(chart.unit));
			this.y += CHART_HEIGHT + SECTION_GAP;
		}
		for (const table of this.report.tables) {
			this.drawTable(table);
		}
		this.drawFooters();
	}

	private contentWidth(): number {
		return this.doc.page.width - 2 * PAGE_MARGIN;
	}

	private bottom(): number {
		return this.doc.page.height - PAGE_MARGIN;
	}

	/** Starts a new page unless `height` points still fit. */
	private ensureSpace(height: number): void {
		if (this.y + height > this.bottom()) {
			this.newPage();
		}
	}

	private newPage(): void {
		this.doc.addPage();
		this.y = PAGE_MARGIN;
	}

	/** One full-width line (cut with "…" if too long), then the cursor moves below it. */
	private line(value: string, style: PdfTextStyle): void {
		this.text.draw(value, PAGE_MARGIN, this.y, style, { width: this.contentWidth(), align: "left" });
		this.y += this.text.lineHeight(style.size) + LINE_GAP;
	}

	private drawHeader(): void {
		const { report } = this;
		this.doc.rect(0, 0, this.doc.page.width, BAND_HEIGHT).fillColor(COLORS.brand).fill();
		this.line(report.brand.toUpperCase(), { size: BRAND_FONT_SIZE, weight: "bold", color: COLORS.brand });
		this.line(report.title, { size: TITLE_FONT_SIZE, weight: "bold", color: COLORS.text });
		this.line(report.subjectName, { size: SUBTITLE_FONT_SIZE, weight: "regular", color: COLORS.text });
		const meta: PdfTextStyle = { size: META_FONT_SIZE, weight: "regular", color: COLORS.muted };
		this.line(`Range: ${formatRange(report.range)}`, meta);
		const previous = formatRange({ from: report.range.previousFrom, to: report.range.previousTo, timeZone: report.range.timeZone });
		this.line(`Interval: ${ANALYTICS_INTERVAL_LABELS[report.range.interval]} · Currency: ${report.currency} · Compared with ${previous}`, meta);
		this.line(`Generated ${formatTimestampUtc(report.generatedAt)}`, meta);
		this.y += SECTION_GAP / 2;
	}

	private drawKpis(): void {
		const cardWidth = (this.contentWidth() - (KPI_COLUMNS - 1) * KPI_GAP) / KPI_COLUMNS;
		const top = this.y;
		this.report.kpis.forEach((kpi, index) => {
			const column = index % KPI_COLUMNS;
			const row = Math.floor(index / KPI_COLUMNS);
			this.drawKpiCard(kpi, PAGE_MARGIN + column * (cardWidth + KPI_GAP), top + row * (KPI_CARD_HEIGHT + KPI_GAP), cardWidth);
		});
		this.y = top + Math.ceil(this.report.kpis.length / KPI_COLUMNS) * (KPI_CARD_HEIGHT + KPI_GAP) + SECTION_GAP;
	}

	private drawKpiCard(kpi: AnalyticsReportKpi, x: number, y: number, width: number): void {
		const { comparison } = kpi;
		const { currency } = this.report;
		const box: PdfTextBox = { width: width - 2 * KPI_PADDING, align: "left" };
		this.doc.rect(x, y, width, KPI_CARD_HEIGHT).lineWidth(1).strokeColor(COLORS.rule).stroke();
		this.text.draw(kpi.label, x + KPI_PADDING, y + KPI_PADDING, { size: KPI_LABEL_FONT_SIZE, weight: "regular", color: COLORS.muted }, box);
		this.text.draw(
			formatUnitValue(comparison.value, kpi.unit, currency),
			x + KPI_PADDING,
			y + KPI_PADDING + KPI_VALUE_OFFSET,
			{
				size: KPI_VALUE_FONT_SIZE,
				weight: "bold",
				color: COLORS.text,
			},
			box,
		);
		const changeColor = comparison.change > 0 ? COLORS.positive : comparison.change < 0 ? COLORS.negative : COLORS.muted;
		this.text.draw(
			formatChange(comparison.change, comparison.changePercent, kpi.unit, currency),
			x + KPI_PADDING,
			y + KPI_PADDING + KPI_CHANGE_OFFSET,
			{
				size: KPI_CHANGE_FONT_SIZE,
				weight: "regular",
				color: changeColor,
			},
			box,
		);
	}

	private chartStyle(unit: "money" | "count"): ChartStyle {
		const { currency, range } = this.report;
		return {
			formatValue: (value: number): string => (unit === "money" ? compactFormatter.format(minorToMajor(value, currency)) : compactFormatter.format(value)),
			labelOf: (start: number): string => bucketLabel(start, range.interval, range.timeZone),
			palette: CHART_PALETTE,
			axisColor: COLORS.axis,
			gridColor: COLORS.grid,
			textColor: COLORS.muted,
		};
	}

	/**
	 * Column widths: numbers / dates get a fixed width; text columns share the
	 * rest, in proportion to their widest measured content (min {@link MIN_TEXT_COLUMN_WIDTH}).
	 */
	private columnWidths(table: AnalyticsReportTable): number[] {
		const { columns } = table;
		// A number / date column is at least as wide as its (bold) header, so the header is never cut.
		const fixedWidthOf = (column: AnalyticsReportColumn): number =>
			Math.max(
				column.kind === "boolean" ? NARROW_COLUMN_WIDTH : FIXED_COLUMN_WIDTH,
				this.text.width(this.headerLabel(column), TABLE_FONT_SIZE, "bold") + 2 * TABLE_CELL_PADDING,
			);
		const available = this.contentWidth();
		const textIndexes = columns.flatMap((column, index) => (column.kind === "text" ? [index] : []));
		if (textIndexes.length === 0) {
			return columns.map(() => available / columns.length);
		}
		const fixedTotal = columns.filter((column) => column.kind !== "text").reduce((total, column) => total + fixedWidthOf(column), 0);
		const textSpace = Math.max(MIN_TEXT_COLUMN_WIDTH * textIndexes.length, available - fixedTotal);
		const widest = new Map(
			textIndexes.map((index) => [
				index,
				Math.max(
					MIN_TEXT_COLUMN_WIDTH,
					...table.rows.map((row) => {
						const cell = row[index];
						return cell?.kind === "text" ? this.text.width(cell.value, TABLE_FONT_SIZE, "regular") + 2 * TABLE_CELL_PADDING : 0;
					}),
				),
			]),
		);
		const totalWidest = [...widest.values()].reduce((total, width) => total + width, 0);
		return columns.map((column, index) => (column.kind === "text" ? (textSpace * (widest.get(index) ?? MIN_TEXT_COLUMN_WIDTH)) / totalWidest : fixedWidthOf(column)));
	}

	private drawTable(table: AnalyticsReportTable): void {
		const widths = this.columnWidths(table);
		const title: PdfTextStyle = { size: SECTION_FONT_SIZE, weight: "bold", color: COLORS.text };
		this.ensureSpace(this.text.lineHeight(SECTION_FONT_SIZE) + 2 * TABLE_ROW_HEIGHT);
		this.line(table.title, title);
		this.drawTableHeader(table.columns, widths);
		if (table.rows.length === 0) {
			this.drawRow([{ text: "No data in this range", align: "left" }], [this.contentWidth()], false, "regular");
		}
		table.rows.forEach((row, rowIndex) => {
			if (this.y + TABLE_ROW_HEIGHT > this.bottom()) {
				this.newPage();
				this.line(`${table.title} (continued)`, title);
				this.drawTableHeader(table.columns, widths);
			}
			this.drawRow(
				row.map((cell) => this.cellText(cell)),
				widths,
				rowIndex % 2 === 1,
				"regular",
			);
		});
		this.y += SECTION_GAP;
	}

	/** A column header naming the currency of a money column. */
	private headerLabel(column: AnalyticsReportColumn): string {
		return column.kind === "money" ? `${column.header} (${this.report.currency})` : column.header;
	}

	private drawTableHeader(columns: readonly AnalyticsReportColumn[], widths: readonly number[]): void {
		this.doc.rect(PAGE_MARGIN, this.y, this.contentWidth(), TABLE_ROW_HEIGHT).fillColor(COLORS.headerFill).fill();
		this.drawRow(
			columns.map((column) => ({
				text: column.kind === "money" ? `${column.header} (${this.report.currency})` : column.header,
				align: column.kind === "text" ? "left" : "right",
			})),
			widths,
			false,
			"bold",
		);
	}

	private drawRow(cells: readonly PdfCell[], widths: readonly number[], isShaded: boolean, weight: ReportFontWeight): void {
		if (isShaded) {
			this.doc.rect(PAGE_MARGIN, this.y, this.contentWidth(), TABLE_ROW_HEIGHT).fillColor(COLORS.zebraFill).fill();
		}
		let x = PAGE_MARGIN;
		cells.forEach((cell, index) => {
			const width = widths[index] ?? 0;
			this.text.draw(
				cell.text,
				x + TABLE_CELL_PADDING,
				this.y + TABLE_TEXT_OFFSET,
				{ size: TABLE_FONT_SIZE, weight, color: COLORS.text },
				{
					width: width - 2 * TABLE_CELL_PADDING,
					align: cell.align,
				},
			);
			x += width;
		});
		this.y += TABLE_ROW_HEIGHT;
	}

	private cellText(cell: AnalyticsReportCell): PdfCell {
		const { currency, range } = this.report;
		switch (cell.kind) {
			case "text":
				return { text: cell.value, align: "left" };
			case "count":
				return { text: formatCount(cell.value), align: "right" };
			case "money":
				return { text: formatMoney(cell.minor, currency), align: "right" };
			case "percent":
				return { text: formatPercent(cell.value), align: "right" };
			case "date":
				return { text: localDateInTimeZone(cell.epochMs, range.timeZone), align: "right" };
			case "boolean":
				return { text: cell.value ? "Yes" : "No", align: "right" };
			default:
				return assertNever(cell, "report cell");
		}
	}

	/** "Brand · Subject · Page n of m" on every page (pages are buffered until the end so `m` is known). */
	private drawFooters(): void {
		const pages = this.doc.bufferedPageRange();
		for (let index = pages.start; index < pages.start + pages.count; index += 1) {
			this.doc.switchToPage(index);
			// Writing below the bottom margin would otherwise make PDFKit start a new page.
			this.doc.page.margins.bottom = 0;
			this.text.draw(
				`${this.report.brand} · ${this.report.subjectName} · Page ${String(index - pages.start + 1)} of ${String(pages.count)}`,
				PAGE_MARGIN,
				this.doc.page.height - PAGE_MARGIN + FOOTER_OFFSET,
				{ size: FOOTER_FONT_SIZE, weight: "regular", color: COLORS.muted },
				{ width: this.contentWidth(), align: "center" },
			);
		}
	}
}

/** One cell of a PDF table row. */
interface PdfCell {
	readonly text: string;
	readonly align: "left" | "right";
}
