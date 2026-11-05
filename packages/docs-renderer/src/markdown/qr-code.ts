import { DEFAULT_QR_QUIET_ZONE_MODULES, encodeQr, qrMatrixToSvgPath } from "@workspace/shared";
import type { Code, Html, Root } from "mdast";
import { visit } from "unist-util-visit";

import { parseCodeTitle } from "./fence-meta";
import { escapeHtml } from "./html";

/**
 * ```` ```qr ```` fences become a scannable QR code, drawn at BUILD time by the shared in-house
 * encoder (`encodeQr` from @workspace/shared — the same one the apps and the API use) as inline
 * SVG: no client script, no image file, no third-party library. The fence body is the text to
 * encode; `title="…"` names the code for screen readers (otherwise "QR code of <text>").
 *
 * ````md
 * ```qr title="Terminal pairing QR"
 * pos-pair:v1:ABCD2345
 * ```
 * ````
 */

/** The fence language that marks a QR code. */
export const QR_FENCE_LANGUAGE = "qr";

/** The accessible name of a QR code: the fence's `title`, or one naming what it encodes. */
export function qrCodeLabel(text: string, title: string | null): string {
	return title ?? `QR code of ${text}`;
}

/**
 * The HTML of one docs QR code: a `<figure>` holding an inline `<svg>` (one path, the standard
 * 4-module quiet zone on a light background, dark modules from the docs' `--qr-*` tokens) and
 * the encoded text as its caption.
 */
export function qrCodeFigureHtml(text: string, title: string | null): string {
	const { path, viewBoxSize } = qrMatrixToSvgPath(encodeQr(text), { quietZoneModules: DEFAULT_QR_QUIET_ZONE_MODULES });
	const size = String(viewBoxSize);
	return (
		`<figure class="qr-code">` +
		`<svg role="img" aria-label="${escapeHtml(qrCodeLabel(text, title))}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
		`<rect class="qr-code-background" width="${size}" height="${size}"/><path class="qr-code-modules" d="${path}"/></svg>` +
		`<figcaption><code>${escapeHtml(text)}</code></figcaption>` +
		`</figure>`
	);
}

/** Replaces every `qr` fence with its QR code figure (before `rehypeCodeBlock`, so it is never highlighted as code). */
export function remarkQrCode(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "code", (node: Code, index, parent) => {
			if (node.lang !== QR_FENCE_LANGUAGE || parent === undefined || index === undefined) {
				return;
			}
			const html: Html = { type: "html", value: qrCodeFigureHtml(node.value.trim(), parseCodeTitle(node.meta ?? "")) };
			parent.children.splice(index, 1, html);
		});
	};
}
