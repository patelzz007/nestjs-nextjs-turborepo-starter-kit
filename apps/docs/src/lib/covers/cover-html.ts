/**
 * A guide's cover as one HTML page, which `scripts/covers.ts` photographs in Chromium: a deep glow in the
 * guide's two tones with a dot grid, arcs, a light streak and grain; a real screenshot of the apps in a tilted
 * browser window (a phone frame for a phone screen); and, in front, the card that says what the guide is about
 * (`cover-detail.ts`). Code is highlighted with the docs' own One Dark Pro (with its AA lifts), diagrams are
 * drawn by Pele in the dark theme, and every colour comes from the design tokens.
 *
 * The page is {@link COVER_WIDTH} × {@link COVER_HEIGHT} (a sharing-image shape). The docs site shows the
 * middle band, {@link COVER_BAND_HEIGHT} tall (its 3.6:1 cover ratio), so the card sits wholly inside it.
 */
import { highlightCode, type CodeBlockLine, type CodeBlockThemes } from "@workspace/ui/components/code-block-highlight";
import { renderStaticDiagram } from "@workspace/ui/lib/diagram/static-diagram";
import { createColorLookups, formatSrgbHex, resolveColorValue, TOKEN_SOURCE, type ColorTokenName } from "@workspace/tokens";

import type { CoverDetail, TerminalLine } from "./cover-detail";
import { isPhoneScreenshot } from "./cover-screenshot";
import type { CoverSpec } from "./cover-spec";

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 840;
/** The docs site's cover band: {@link COVER_WIDTH} ÷ 3.6. */
export const COVER_BAND_HEIGHT = 444;
const BAND_TOP = (COVER_HEIGHT - COVER_BAND_HEIGHT) / 2;

/** Absolute file URLs of the fonts and screenshots the page loads. */
export interface CoverAssets {
	readonly fontSans: string;
	readonly fontMono: string;
	readonly screenshot: (name: string) => string;
}

/** Both sides One Dark Pro: a cover's code is always on the dark card. */
const CODE_THEMES: CodeBlockThemes = { light: "one-dark-pro", dark: "one-dark-pro" };
/** One Dark Pro's colours for the parts of an HTTP request (no grammar ships for it). */
const HTTP_COLORS = { method: "#c678dd", path: "#61afef", version: "#90949d", header: "#e1717a", value: "#98c379", text: "#abb2bf" };
const REQUEST_LINE_PATTERN = /^(?<method>[A-Z]+)(?<gap>\s+)(?<path>\S+)(?<version>.*)$/u;
const HEADER_LINE_PATTERN = /^(?<name>[\w-]+):(?<value>.*)$/u;
const JSON_LANGUAGE = "json";

const STATUS_TONES: Readonly<Record<string, ColorTokenName>> = {
	Accepted: "tone-green",
	Proposed: "tone-yellow",
	Superseded: "tone-orange",
	Deprecated: "tone-red",
	Rejected: "tone-red",
};
const NEUTRAL_STATUS_TONE: ColorTokenName = "muted-foreground";

export function escapeHtml(text: string): string {
	return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
}

/** A token's literal colour in the dark theme, as `#rrggbb`. */
export function darkTokenHex(token: ColorTokenName): string {
	return formatSrgbHex(resolveColorValue({ kind: "token", name: token }, createColorLookups(TOKEN_SOURCE, "dark")));
}

function span(color: string, text: string): string {
	return text.length === 0 ? "" : `<span style="color:${color}">${escapeHtml(text)}</span>`;
}

function linesHtml(lines: readonly CodeBlockLine[]): string {
	return lines
		.map(
			(line) =>
				`<p>${line.tokens.map((token) => `<span style="color:${token.color ?? HTTP_COLORS.text}${token.fontStyle === "italic" ? ";font-style:italic" : ""}">${escapeHtml(token.content)}</span>`).join("")}</p>`,
		)
		.join("");
}

/** Code highlighted like the docs' code blocks. */
export async function highlightedCode(code: string, language: string): Promise<string> {
	return linesHtml(await highlightCode(code, { language, themes: CODE_THEMES }));
}

/** One line of an HTTP request's head: the request line, a header, or plain text. */
function httpHeadLine(line: string, isFirst: boolean): string {
	const request = isFirst ? REQUEST_LINE_PATTERN.exec(line)?.groups : undefined;
	if (request !== undefined) {
		return `<p>${span(HTTP_COLORS.method, request.method ?? "")}${request.gap ?? ""}${span(HTTP_COLORS.path, request.path ?? "")}${span(HTTP_COLORS.version, request.version ?? "")}</p>`;
	}
	const header = HEADER_LINE_PATTERN.exec(line)?.groups;
	if (header !== undefined) {
		return `<p>${span(HTTP_COLORS.header, header.name ?? "")}${span(HTTP_COLORS.text, ":")}${span(HTTP_COLORS.value, header.value ?? "")}</p>`;
	}
	return `<p>${span(HTTP_COLORS.text, line)}</p>`;
}

/** An HTTP request: its head coloured part by part, its body (after the first blank line) highlighted as JSON. */
export async function httpCode(code: string): Promise<string> {
	const [head = "", ...bodyParts] = code.split(/\n\s*\n/u);
	const body = bodyParts.join("\n\n");
	const headHtml = head
		.split("\n")
		.map((line, index) => httpHeadLine(line, index === 0))
		.join("");
	return body.length === 0 ? headHtml : `${headHtml}<p>&nbsp;</p>${await highlightedCode(body, JSON_LANGUAGE)}`;
}

function terminalHtml(lines: readonly TerminalLine[]): string {
	return lines.map((line) => (line.tone === "comment" ? `<p class="comment">${escapeHtml(line.text)}</p>` : `<p><b>$</b> ${escapeHtml(line.text)}</p>`)).join("");
}

function tagsHtml(tags: readonly string[]): string {
	return tags.length === 0 ? "" : `<div class="tags">${tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function windowBar(title: string): string {
	return `<div class="bar"><i></i><i></i><i></i><span>${escapeHtml(title)}</span></div>`;
}

/** The card in front: what the guide is about. */
export async function cardHtml(detail: CoverDetail, label: string): Promise<string> {
	switch (detail.kind) {
		case "code":
			return `<div class="card code">${windowBar(label)}<div class="body">${await highlightedCode(detail.code, detail.language)}</div></div>`;
		case "http":
			return `<div class="card code">${windowBar(label)}<div class="body">${await httpCode(detail.code)}</div></div>`;
		case "terminal":
			return `<div class="card terminal">${windowBar(label)}<div class="body">${terminalHtml(detail.lines)}</div></div>`;
		case "diagram":
			return `<div class="card diagram">${windowBar(label)}<div class="body">${renderStaticDiagram(detail.source, { theme: "dark", idPrefix: "cover" })}</div></div>`;
		case "decision": {
			const status =
				detail.status === null
					? ""
					: `<span class="status" style="--status:${darkTokenHex(STATUS_TONES[detail.status] ?? NEUTRAL_STATUS_TONE)}">${escapeHtml(detail.status)}</span>`;
			return `<div class="card decision">${windowBar(label)}<div class="body"><div class="head"><span class="number">ADR ${escapeHtml(detail.number)}</span>${status}</div>
				<h2>${escapeHtml(detail.title)}</h2><p class="summary">${escapeHtml(detail.summary)}</p>${tagsHtml(detail.tags)}</div></div>`;
		}
		case "summary":
			return `<div class="card decision">${windowBar(label)}<div class="body"><div class="head"><span class="number">Guide</span></div>
				<h2>${escapeHtml(detail.title)}</h2><p class="summary">${escapeHtml(detail.summary)}</p>${tagsHtml(detail.tags)}</div></div>`;
		case "outline":
			return `<div class="card outline">${windowBar(label)}<div class="body"><h3>On this page</h3><ol>${detail.headings
				.map((heading, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(heading)}</li>`)
				.join("")}</ol></div></div>`;
	}
}

/** The screenshot behind the card: a phone screen in a phone frame, any other in a browser window. */
export function screenshotHtml(screenshot: string, assets: CoverAssets): string {
	const image = `<img src="${escapeHtml(assets.screenshot(screenshot))}" alt="">`;
	return isPhoneScreenshot(screenshot) ? `<figure class="shot phone">${image}</figure>` : `<figure class="shot window">${windowBar("localhost")}${image}</figure>`;
}

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

/** A guide's whole cover page. */
export async function coverHtml(spec: CoverSpec, assets: CoverAssets): Promise<string> {
	const [from, to] = spec.accents.map(darkTokenHex);
	const px = (value: number): string => `${String(value)}px`;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Plex"; src: url("${assets.fontSans}") format("woff2"); font-weight: 100 700; }
@font-face { font-family: "Plex Mono"; src: url("${assets.fontMono}") format("woff2"); font-weight: 400; }
:root { --a: ${from ?? ""}; --b: ${to ?? ""}; --band: ${px(BAND_TOP)}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${px(COVER_WIDTH)}; height: ${px(COVER_HEIGHT)}; overflow: hidden; }
body { position: relative; font-family: "Plex", sans-serif; color: #e6e9ef;
  background:
    radial-gradient(640px 460px at 6% 78%, color-mix(in oklab, var(--a) 55%, transparent), transparent 70%),
    radial-gradient(760px 480px at 44% 18%, color-mix(in oklab, var(--b) 58%, transparent), transparent 70%),
    radial-gradient(980px 560px at 94% 62%, color-mix(in oklab, var(--a) 38%, transparent), transparent 72%),
    linear-gradient(135deg, #0a0e16, #111726 55%, #0b1020); }
.dots { position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .16) 1px, transparent 1.2px); background-size: 22px 22px;
  mask-image: radial-gradient(900px 340px at 22% 50%, black, transparent 75%); }
.grain { position: absolute; inset: 0; background-image: ${GRAIN}; opacity: .10; mix-blend-mode: overlay; }
.arcs { position: absolute; left: -140px; top: 40px; width: 820px; height: 820px; border-radius: 50%;
  border: 1px solid rgb(255 255 255 / .07); box-shadow: 0 0 0 64px rgb(255 255 255 / .015), 0 0 0 150px rgb(255 255 255 / .012); }
.streak { position: absolute; left: 320px; top: -120px; width: 170px; height: 1100px; transform: rotate(28deg);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / .06), transparent); filter: blur(6px); }
.stage { position: absolute; inset: 0; perspective: 1900px; }
.shot { position: absolute; overflow: hidden; background: #0d1117; border: 1px solid rgb(255 255 255 / .14);
  box-shadow: 0 60px 120px -30px rgb(0 0 0 / .75), 0 18px 40px -18px rgb(0 0 0 / .6), inset 0 1px 0 rgb(255 255 255 / .08); }
.shot img { display: block; width: 100%; }
.window { left: 700px; top: calc(var(--band) + 40px); width: 1040px; border-radius: 14px; transform: rotateX(10deg) rotateY(-20deg) rotateZ(3deg); transform-origin: left center; }
.phone { left: 1060px; top: calc(var(--band) + 14px); width: 330px; padding: 10px; border-radius: 48px; background: #05070b;
  transform: rotateY(-22deg) rotateZ(5deg); }
.phone img { border-radius: 38px; }
.bar { display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; background: #21252b; border-bottom: 1px solid #181a1f;
  font: 500 12px/1 "Plex Mono", monospace; color: #9aa0ab; }
.bar i { width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; }
.bar i:nth-child(2) { background: #febc2e; } .bar i:nth-child(3) { background: #28c840; }
.bar span { margin-left: 10px; padding: 3px 10px; border-radius: 6px; background: rgb(255 255 255 / .05); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card { position: absolute; left: 440px; top: calc(var(--band) + 66px); width: 520px; max-height: 312px; border-radius: 14px; overflow: hidden; background: #282c34;
  border: 1px solid rgb(255 255 255 / .12);
  box-shadow: 0 50px 100px -24px rgb(0 0 0 / .8), 0 0 0 1px rgb(0 0 0 / .4), 0 0 90px -20px color-mix(in oklab, var(--a) 65%, transparent);
  transform: perspective(1400px) rotateY(-8deg) rotateX(4deg); }
.card .body { padding: 16px 18px 18px; font: 15px/1.65 "Plex Mono", monospace; }
.code .body p, .terminal .body p { white-space: pre; color: #abb2bf; }
.terminal .body p { color: #e6e9ef; } .terminal .body p b { color: var(--a); font-weight: 400; } .terminal .body p.comment { color: #90949d; }
.diagram { background: #1b1f27; } .diagram .body { padding: 14px; display: grid; place-items: center; }
.diagram svg { display: block; max-width: 100%; max-height: 252px; width: auto; height: auto; }
.decision, .outline { background: linear-gradient(160deg, #20252f, #181c24); }
.decision .body, .outline .body { font-family: "Plex", sans-serif; padding: 20px 24px 22px; }
.decision .head { display: flex; align-items: center; gap: 12px; }
.decision .number { font: 600 15px "Plex Mono", monospace; letter-spacing: .04em; color: var(--a); }
.decision .status { font-size: 12.5px; font-weight: 600; padding: 3px 10px; border-radius: 999px; color: var(--status);
  background: color-mix(in oklab, var(--status) 16%, transparent); border: 1px solid color-mix(in oklab, var(--status) 40%, transparent); }
.decision h2 { margin-top: 12px; font-size: 26px; line-height: 1.2; font-weight: 600; color: #f3f5f8; letter-spacing: -.01em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.decision .summary { margin-top: 10px; font-size: 15px; line-height: 1.55; color: #a9b0bc; white-space: normal;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.decision .tags { margin-top: 14px; display: flex; gap: 8px; }
.decision .tags span { font: 500 12.5px "Plex Mono", monospace; color: #c4cad4; padding: 3px 9px; border-radius: 7px; background: rgb(255 255 255 / .06); border: 1px solid rgb(255 255 255 / .08); }
.outline h3 { font: 600 12px "Plex Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--a); }
.outline ol { list-style: none; margin-top: 12px; display: grid; gap: 2px; border-left: 1px solid rgb(255 255 255 / .1); }
.outline li { display: flex; gap: 12px; align-items: baseline; padding: 5px 0 5px 16px; font-size: 16.5px; color: #dfe3ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.outline li b { font: 500 12.5px "Plex Mono", monospace; color: #7d8592; }
.vignette { position: absolute; inset: 0; background: radial-gradient(1500px 620px at 50% 50%, transparent 58%, rgb(0 0 0 / .5)); pointer-events: none; }
</style></head><body>
<div class="arcs"></div><div class="streak"></div><div class="dots"></div>
<div class="stage">${screenshotHtml(spec.screenshot, assets)}${await cardHtml(spec.detail, spec.label)}</div>
<div class="grain"></div><div class="vignette"></div>
</body></html>`;
}
