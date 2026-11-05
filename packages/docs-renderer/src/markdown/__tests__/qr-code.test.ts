import { DEFAULT_QR_QUIET_ZONE_MODULES, encodeQr, qrMatrixToSvgPath } from "@workspace/shared";
import type { Root, RootContent } from "mdast";
import { describe, expect, it } from "vitest";

import { QR_FENCE_LANGUAGE, qrCodeFigureHtml, qrCodeLabel, remarkQrCode } from "../qr-code";

function rootOf(children: RootContent[]): Root {
	return { type: "root", children };
}

describe("qrCodeLabel", () => {
	it("uses the fence title, or names what the code encodes", () => {
		expect(qrCodeLabel("pos-pair:v1:ABCD2345", "Terminal pairing QR")).toBe("Terminal pairing QR");
		expect(qrCodeLabel("pos-pair:v1:ABCD2345", null)).toBe("QR code of pos-pair:v1:ABCD2345");
	});
});

describe("qrCodeFigureHtml", () => {
	it("draws the shared encoder's path in a square viewBox with the standard quiet zone", () => {
		const expected = qrMatrixToSvgPath(encodeQr("https://example.com"), { quietZoneModules: DEFAULT_QR_QUIET_ZONE_MODULES });
		const html = qrCodeFigureHtml("https://example.com", null);
		const size = String(expected.viewBoxSize);
		expect(html).toContain(`viewBox="0 0 ${size} ${size}"`);
		expect(html).toContain(`<path class="qr-code-modules" d="${expected.path}"/>`);
		expect(html).toContain('shape-rendering="crispEdges"');
		expect(html.startsWith('<figure class="qr-code">')).toBe(true);
	});

	it("is one named image with the encoded text as its caption, escaped", () => {
		const html = qrCodeFigureHtml('a<b>&"c"', "Sample <code>");
		expect(html).toContain('role="img" aria-label="Sample &lt;code&gt;"');
		expect(html).toContain("<figcaption><code>a&lt;b&gt;&amp;&quot;c&quot;</code></figcaption>");
	});
});

describe("remarkQrCode", () => {
	it("replaces a qr fence with its figure, trimming the body and reading the title", () => {
		const root = rootOf([
			{ type: "paragraph", children: [{ type: "text", value: "Scan it:" }] },
			{ type: "code", lang: QR_FENCE_LANGUAGE, meta: 'title="Pairing QR"', value: "pos-pair:v1:ABCD2345\n" },
		]);
		remarkQrCode()(root);

		const [, figure] = root.children;
		expect(figure).toEqual({ type: "html", value: qrCodeFigureHtml("pos-pair:v1:ABCD2345", "Pairing QR") });
	});

	it("names an untitled code after its text", () => {
		const root = rootOf([{ type: "code", lang: QR_FENCE_LANGUAGE, meta: null, value: "HELLO" }]);
		remarkQrCode()(root);

		const [figure] = root.children;
		expect(figure).toEqual({ type: "html", value: qrCodeFigureHtml("HELLO", null) });
	});

	it("leaves every other fence alone", () => {
		const fence: RootContent = { type: "code", lang: "ts", meta: null, value: "const qr = 1;" };
		const root = rootOf([fence]);
		remarkQrCode()(root);

		expect(root.children).toEqual([fence]);
	});
});
