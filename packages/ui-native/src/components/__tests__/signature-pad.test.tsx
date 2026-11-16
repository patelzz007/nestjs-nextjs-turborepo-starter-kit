import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { isSignatureEmpty, SignaturePad, signatureToSvg, strokePath, useSignatureHistory, type SignatureStroke } from "../signature-pad";

const LINE: SignatureStroke = [
	{ x: 0, y: 0 },
	{ x: 0.5, y: 1 },
];

describe("the signature helpers", () => {
	it("say whether anything is drawn, and draw a stroke as a path at any size", () => {
		expect(isSignatureEmpty([])).toBe(true);
		expect(isSignatureEmpty([[]])).toBe(true);
		expect(isSignatureEmpty([LINE])).toBe(false);
		expect(strokePath(LINE, 200, 100)).toBe("M0 0 L100 100");
		expect(strokePath([{ x: 0.5, y: 0.5 }], 10, 10)).toBe("M5 5 l0.01 0");
		expect(strokePath([], 10, 10)).toBe("");
	});

	it("write the strokes as an SVG document", () => {
		const svg = signatureToSvg([LINE, []], { width: 200, height: 100, color: "#111827", strokeWidth: 3 });
		expect(svg).toContain('viewBox="0 0 200 100"');
		expect(svg).toContain('stroke="#111827" stroke-width="3"');
		expect(svg.match(/<path /gu)).toHaveLength(1);
	});
});

describe("useSignatureHistory", () => {
	it("undoes, redoes and clears, and a new stroke forgets what was undone", async () => {
		const { result } = await renderHook(() => useSignatureHistory());
		await act((): void => {
			result.current.onChange([LINE]);
		});
		await act((): void => {
			result.current.onChange([LINE, LINE]);
		});
		await act((): void => {
			result.current.undo();
		});
		expect(result.current.strokes).toHaveLength(1);
		expect(result.current.canRedo).toBe(true);
		await act((): void => {
			result.current.redo();
		});
		expect(result.current.strokes).toHaveLength(2);
		await act((): void => {
			result.current.clear();
		});
		expect(result.current.strokes).toHaveLength(0);
		await act((): void => {
			result.current.undo();
		});
		expect(result.current.strokes).toHaveLength(2);
		await act((): void => {
			result.current.onChange([LINE]);
		});
		expect(result.current.canRedo).toBe(false);
		expect(result.current.canUndo).toBe(true);
	});
});

describe("SignaturePad", () => {
	it("draws a stroke where the finger goes and reports it when the finger lifts", async () => {
		const onChange = jest.fn();
		const onDrawingChange = jest.fn();
		await render(<SignaturePad strokes={[]} onChange={onChange} onDrawingChange={onDrawingChange} testID="pad" />);
		const pad = screen.getByTestId("pad");
		expect(pad).toHaveProp("accessibilityLabel", "Signature, empty");
		expect(screen.getByText("Sign here")).toBeOnTheScreen();
		await fireEvent(pad, "layout", { nativeEvent: { layout: { width: 200, height: 100 } } });
		await fireEvent(pad, "responderGrant", { nativeEvent: { locationX: 0, locationY: 0 } });
		await fireEvent(pad, "responderMove", { nativeEvent: { locationX: 100, locationY: 100 } });
		await fireEvent(pad, "responderRelease");
		expect(onChange).toHaveBeenCalledWith([LINE]);
		expect(onDrawingChange.mock.calls).toStrictEqual([[true], [false]]);
	});

	it("says how many strokes it holds, and takes no ink when read only", async () => {
		const ref = React.createRef<ViewInstance>();
		const onChange = jest.fn();
		await render(<SignaturePad ref={ref} strokes={[LINE, LINE]} onChange={onChange} readOnly testID="pad" />);
		const pad = screen.getByTestId("pad");
		expect(pad).toHaveProp("accessibilityLabel", "Signature, 2 strokes");
		await fireEvent(pad, "responderGrant", { nativeEvent: { locationX: 0, locationY: 0 } });
		await fireEvent(pad, "responderMove", { nativeEvent: { locationX: 10, locationY: 10 } });
		await fireEvent(pad, "responderRelease");
		expect(onChange).not.toHaveBeenCalled();
		expect(ref.current).not.toBeNull();
	});
});
