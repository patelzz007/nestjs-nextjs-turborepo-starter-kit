// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import {
	getSignaturePadBounds,
	getSignaturePadStrokePath,
	serializeSignaturePad,
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadPreview,
	SignaturePadRedo,
	SignaturePadUndo,
	signaturePadToSVG,
	type SignaturePadApi,
	type SignaturePadProps,
	type SignaturePadStroke,
} from "./signature-pad";

const LABELS = UI_KIT_LABELS_EN.signaturePad;
const STROKE: SignaturePadStroke = {
	points: [
		[10, 10, 2],
		[40, 20, 2.5],
		[80, 15, 2],
	],
};
const DOT: SignaturePadStroke = { points: [[5, 5, 2]] };
/** A stubbed data URL: jsdom cannot rasterize. */
const STUB_DATA_URL = "data:image/png;base64,stub";

function renderPad(props: Partial<SignaturePadProps> = {}): HTMLElement {
	render(
		<SignaturePad {...props}>
			<SignaturePadArea>
				<SignaturePadGuide />
				<SignaturePadPlaceholder />
				<SignaturePadControls>
					<SignaturePadUndo />
					<SignaturePadRedo />
					<SignaturePadClear />
				</SignaturePadControls>
			</SignaturePadArea>
		</SignaturePad>,
		{ wrapper: UiKitTestProviders },
	);
	return screen.getByRole("application", { name: LABELS.area });
}

/** One mouse stroke from (10, 10) to (60, 30), drawn on the area itself. */
function drawStroke(area: HTMLElement): void {
	const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
	fireEvent.pointerDown(area, { ...pointer, clientX: 10, clientY: 10 });
	fireEvent.pointerMove(area, { ...pointer, clientX: 35, clientY: 20 });
	fireEvent.pointerMove(area, { ...pointer, clientX: 60, clientY: 30 });
	fireEvent.pointerUp(area, { ...pointer, clientX: 60, clientY: 30 });
}

/** The keydowns the shortcut test sends to the area (undo, redo, redo, layout-switched undo). */
const KEY_PRESSES = 4;

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("signature geometry and export", () => {
	it("outlines a stroke as one closed path and a tap as a dot", (): void => {
		expect(getSignaturePadStrokePath(STROKE)).toMatch(/^M.*Z$/);
		expect(getSignaturePadStrokePath(DOT)).toMatch(/^M.*a.*Z$/);
		expect(getSignaturePadStrokePath({ points: [] })).toBe("");
	});

	it("measures the ink, stroke width included", (): void => {
		expect(getSignaturePadBounds([DOT])).toEqual({ x: 4, y: 4, width: 2, height: 2 });
		expect(getSignaturePadBounds([])).toBeNull();
	});

	it("exports SVG with token-friendly ink and escapes attributes", (): void => {
		const svg = signaturePadToSVG([STROKE], { background: 'a"b' });
		expect(svg).toContain('fill="currentColor"');
		expect(svg).toContain("&#34;");
		expect(signaturePadToSVG([{ ...STROKE, color: "var(--primary)" }])).toContain('fill="var(--primary)"');
	});

	it("serializes an empty pad to an empty string, and strokes per format", (): void => {
		expect(serializeSignaturePad([], "svg")).toBe("");
		expect(serializeSignaturePad([STROKE], "json")).toBe(JSON.stringify([STROKE]));
		expect(serializeSignaturePad([STROKE], "svg")).toMatch(/^data:image\/svg\+xml/);
	});
});

describe("SignaturePad", () => {
	it("is a named, focusable application with a spoken empty status and a placeholder", (): void => {
		const area = renderPad();
		expect(area.getAttribute("aria-label")).toBe(LABELS.area);
		expect(area.getAttribute("aria-roledescription")).toBe(LABELS.roleDescription);
		expect(area.tabIndex).toBe(0);
		expect(screen.getByRole("group", { name: LABELS.controls })).toBeTruthy();
		const statusId = area.getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(statusId)?.textContent).toBe(LABELS.empty);
		expect(screen.getByText(LABELS.placeholder)).toBeTruthy();
		expect(screen.getByRole("button", { name: LABELS.clear })).toHaveProperty("disabled", true);
	});

	it("records a drawn stroke and reports it through onValueChange, onStrokeStart and onStrokeEnd", (): void => {
		const onValueChange = vi.fn<(value: SignaturePadStroke[]) => void>();
		const onStrokeStart = vi.fn<() => void>();
		const onStrokeEnd = vi.fn<(stroke: SignaturePadStroke) => void>();
		const area = renderPad({ onValueChange, onStrokeStart, onStrokeEnd });
		drawStroke(area);

		expect(onStrokeStart).toHaveBeenCalledWith({ pointerType: "mouse" });
		expect(onValueChange).toHaveBeenCalledTimes(1);
		const strokes = onValueChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first] ?? [];
		expect(strokes).toHaveLength(1);
		expect(onStrokeEnd).toHaveBeenCalledTimes(1);
		expect(area.dataset.empty).toBeUndefined();
		expect(document.getElementById(area.getAttribute("aria-describedby") ?? "")?.textContent).toBe(LABELS.signed);
		expect(screen.queryByText(LABELS.placeholder)).toBeNull();
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(1);
	});

	it("clears, undoes and redoes through its controls", (): void => {
		const onValueChange = vi.fn<(value: SignaturePadStroke[]) => void>();
		const area = renderPad({ onValueChange });
		drawStroke(area);

		fireEvent.click(screen.getByRole("button", { name: LABELS.clear }));
		expect(onValueChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]).toEqual([]);
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(0);

		fireEvent.click(screen.getByRole("button", { name: LABELS.undo }));
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(1);

		fireEvent.click(screen.getByRole("button", { name: LABELS.redo }));
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(0);
	});

	it("undoes and redoes with the keyboard shortcuts on the focused area", (): void => {
		const onKeyDown = vi.fn<(event: React.KeyboardEvent<HTMLDivElement>) => void>();
		render(
			<SignaturePad>
				<SignaturePadArea onKeyDown={onKeyDown} />
			</SignaturePad>,
			{ wrapper: UiKitTestProviders },
		);
		const area = screen.getByRole("application", { name: LABELS.area });
		drawStroke(area);
		act((): void => {
			area.focus();
		});
		fireEvent.keyDown(area, { key: "z", code: "KeyZ", ctrlKey: true });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(0);
		fireEvent.keyDown(area, { key: "y", code: "KeyY", ctrlKey: true });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(1);
		fireEvent.keyDown(area, { key: "z", code: "KeyZ", ctrlKey: true, shiftKey: true });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(1);
		// A non-Latin layout still matches the physical key (Cyrillic "я" sits on Z).
		fireEvent.keyDown(area, { key: "я", code: "KeyZ", metaKey: true });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(0);
		expect(onKeyDown).toHaveBeenCalledTimes(KEY_PRESSES);
		expect(document.activeElement).toBe(area);
	});

	it("handles a shortcut pressed on a pinned control, then moves focus to the area", (): void => {
		const area = renderPad();
		drawStroke(area);
		const undo = screen.getByRole("button", { name: LABELS.undo });
		act((): void => {
			undo.focus();
		});
		// Undo is now at the start of history and disables itself; focus must not fall to <body>.
		fireEvent.keyDown(undo, { key: "z", code: "KeyZ", ctrlKey: true });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(0);
		expect(document.activeElement).toBe(area);
	});

	it("focuses the area through api.focus(), and is not a tab stop while disabled", (): void => {
		const apiRef = React.createRef<SignaturePadApi>();
		const area = renderPad({ apiRef });
		act((): void => {
			apiRef.current?.focus();
		});
		expect(document.activeElement).toBe(area);
		cleanup();
		const disabledArea = renderPad({ disabled: true });
		expect(disabledArea.tabIndex).toBe(-1);
		expect(disabledArea.getAttribute("aria-disabled")).toBe("true");
	});

	it("renders a controlled value and leaves changes to the parent", (): void => {
		const onValueChange = vi.fn<(value: SignaturePadStroke[]) => void>();
		const area = renderPad({ value: [STROKE, DOT], onValueChange });
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: LABELS.clear }));
		expect(onValueChange).toHaveBeenCalledWith([]);
		// Controlled: the parent did not apply the change, so the ink stays.
		expect(area.querySelectorAll("[data-slot=signature-pad-stroke]")).toHaveLength(2);
	});

	it("ignores input and shows the disabled state while disabled", (): void => {
		const onValueChange = vi.fn<(value: SignaturePadStroke[]) => void>();
		const area = renderPad({ disabled: true, onValueChange });
		drawStroke(area);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(area.dataset.disabled).toBe("true");
		expect(area.className).toContain("cursor-not-allowed");
		expect(screen.getByRole("button", { name: LABELS.clear })).toHaveProperty("disabled", true);
	});

	it("shows the invalid state from aria-invalid, and speaks read-only", (): void => {
		render(
			<SignaturePad readOnly defaultValue={[STROKE]}>
				<SignaturePadArea aria-invalid />
			</SignaturePad>,
			{ wrapper: UiKitTestProviders },
		);
		const area = screen.getByRole("application", { name: LABELS.area });
		expect(area.className).toContain("border-destructive");
		expect(area.getAttribute("aria-invalid")).toBe("true");
		expect(area.dataset.invalid).toBe("true");
		expect(document.getElementById(area.getAttribute("aria-describedby") ?? "")?.textContent).toBe(LABELS.readOnlyStatus(LABELS.signed));
	});

	it("exposes its API through apiRef", (): void => {
		const apiRef = React.createRef<SignaturePadApi>();
		const onValueChange = vi.fn<(value: SignaturePadStroke[]) => void>();
		renderPad({ apiRef, defaultValue: [STROKE], onValueChange });
		expect(apiRef.current?.isEmpty).toBe(false);
		expect(apiRef.current?.toSVG()).toContain("<path");
		act((): void => {
			apiRef.current?.clear();
		});
		expect(onValueChange).toHaveBeenCalledWith([]);
		expect(apiRef.current?.isEmpty).toBe(true);
		expect(apiRef.current?.canUndo).toBe(true);
	});

	it("does not crash when the browser gives no 2D canvas context", (): void => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(STUB_DATA_URL);
		const apiRef = React.createRef<SignaturePadApi>();
		renderPad({ apiRef, defaultValue: [STROKE] });
		expect(apiRef.current?.toDataURL()).toBe(STUB_DATA_URL);
		expect(apiRef.current?.serialize("png")).toBe(STUB_DATA_URL);
	});

	it("submits the signature with a native form field", (): void => {
		render(
			<form>
				<SignaturePad name="signature" format="json" defaultValue={[DOT]}>
					<SignaturePadArea />
				</SignaturePad>
			</form>,
			{ wrapper: UiKitTestProviders },
		);
		const field = document.querySelector<HTMLInputElement>("input[name=signature]");
		expect(field?.value).toBe(JSON.stringify([DOT]));
	});

	it("forwards refs and merges className last on every part", (): void => {
		const refs = {
			root: React.createRef<HTMLDivElement>(),
			area: React.createRef<HTMLDivElement>(),
			guide: React.createRef<HTMLDivElement>(),
			placeholder: React.createRef<HTMLDivElement>(),
			controls: React.createRef<HTMLDivElement>(),
		};
		const clearRef = React.createRef<HTMLElement>();
		render(
			<SignaturePad ref={refs.root} className="extra">
				<SignaturePadArea ref={refs.area} className="extra" variant="muted">
					<SignaturePadGuide ref={refs.guide} className="extra" />
					<SignaturePadPlaceholder ref={refs.placeholder} className="extra" />
					<SignaturePadControls ref={refs.controls} className="extra">
						<SignaturePadClear ref={clearRef} />
					</SignaturePadControls>
				</SignaturePadArea>
			</SignaturePad>,
			{ wrapper: UiKitTestProviders },
		);
		const all = Object.values(refs);
		expect(all.map((ref) => ref.current?.dataset.slot)).toEqual([
			"signature-pad",
			"signature-pad-area",
			"signature-pad-guide",
			"signature-pad-placeholder",
			"signature-pad-controls",
		]);
		for (const ref of all) {
			expect(ref.current?.className).toMatch(/extra$/);
		}
		expect(refs.area.current?.dataset.variant).toBe("muted");
		expect(clearRef.current?.dataset.slot).toBe("signature-pad-clear");
	});
});

describe("SignaturePadPreview", () => {
	it("renders saved strokes as a named image, and nothing when empty", (): void => {
		const ref = React.createRef<SVGSVGElement>();
		render(<SignaturePadPreview ref={ref} strokes={[STROKE]} className="extra" />, { wrapper: UiKitTestProviders });
		const preview = screen.getByRole("img", { name: LABELS.preview });
		expect(preview.querySelectorAll("path")).toHaveLength(1);
		expect(ref.current?.dataset.slot).toBe("signature-pad-preview");
		expect(ref.current?.getAttribute("class")).toMatch(/extra$/);
		cleanup();
		render(<SignaturePadPreview strokes={[]} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("img")).toBeNull();
	});
});
