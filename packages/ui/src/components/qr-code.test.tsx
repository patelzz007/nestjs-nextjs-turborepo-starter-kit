// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { encodeQr, qrMatrixToSvgPath } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { QrCode } from "./qr-code";

const VALUE = "https://rewardhub.example/r/ABCD2345";

afterEach(() => {
	cleanup();
});

describe("QrCode", () => {
	it("is one image named by the caller, with the drawing hidden from assistive tech", () => {
		render(<QrCode value={VALUE} label="Reward redemption QR code" />);
		const code = screen.getByRole("img", { name: "Reward redemption QR code" });
		expect(code.dataset.slot).toBe("qr-code");
		expect(code.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	});

	it("draws the shared encoder's modules as one currentColor path, with no inner quiet zone", () => {
		const { container } = render(<QrCode value={VALUE} label="QR" />);
		const expected = qrMatrixToSvgPath(encodeQr(VALUE), { quietZoneModules: 0 });
		const svg = container.querySelector('[data-slot="qr-code-symbol"]');
		const paths = svg?.querySelectorAll("path");
		expect(paths).toHaveLength(1);
		expect(paths?.item(0).getAttribute("d")).toBe(expected.path);
		expect(paths?.item(0).getAttribute("fill")).toBe("currentColor");
		expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${String(expected.viewBoxSize)} ${String(expected.viewBoxSize)}`);
		expect(svg?.getAttribute("shape-rendering")).toBe("crispEdges");
	});

	it("renders at 200 px by default and at the size given", () => {
		const { container, rerender } = render(<QrCode value={VALUE} label="QR" />);
		expect(container.querySelector("svg")?.getAttribute("width")).toBe("200");
		rerender(<QrCode value={VALUE} label="QR" size={128} />);
		expect(container.querySelector("svg")?.getAttribute("width")).toBe("128");
		expect(container.querySelector("svg")?.getAttribute("height")).toBe("128");
	});

	it("redraws when the value changes", () => {
		const { container, rerender } = render(<QrCode value="first" label="QR" />);
		const first = container.querySelector("path")?.getAttribute("d");
		rerender(<QrCode value="second" label="QR" />);
		expect(container.querySelector("path")?.getAttribute("d")).not.toBe(first);
	});

	it("takes its colours from the qr tokens, merges classes and forwards ref and attributes", () => {
		const ref = React.createRef<HTMLDivElement>();
		render(<QrCode ref={ref} value={VALUE} label="QR" className="self-center" data-testid="claim-qr" />);
		const code = screen.getByTestId("claim-qr");
		expect(code.className).toContain("bg-qr-background");
		expect(code.className).toContain("text-qr-foreground");
		expect(code.className).toContain("self-center");
		expect(ref.current).toBe(code);
	});
});
