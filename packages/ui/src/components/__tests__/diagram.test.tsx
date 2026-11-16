import { act, render } from "@testing-library/react";
import type { MountOptions, Mounted } from "pele/lazy";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { Diagram } from "@workspace/ui/components/diagram";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

// Pele draws into the canvas in a real browser (e2e/docs.spec.ts); here the renderer is
// stubbed so the component's contract — what it hands Pele and how it reports progress — is tested.
const { mountAsync } = vi.hoisted(() => ({ mountAsync: vi.fn<(element: HTMLElement, text: string, options?: MountOptions) => Promise<Mounted>>() }));
vi.mock("pele/lazy", () => ({ mountAsync }));

const SOURCE = "flowchart LR\n  accTitle: Two steps\n  a --> b";

interface StubMounted extends Mounted {
	readonly refresh: Mock<() => void>;
	readonly destroy: Mock<() => void>;
}

function stubMounted(): StubMounted {
	return {
		result: undefined,
		source: SOURCE,
		error: undefined,
		zoom: undefined,
		update: vi.fn<(text: string) => void>(),
		refresh: vi.fn<() => void>(),
		destroy: vi.fn<() => void>(),
	};
}

function lastOptions(): MountOptions | undefined {
	const [, , options] = mountAsync.mock.lastCall ?? [];
	return options;
}

function optionsOfCall(index: number): MountOptions | undefined {
	const [, , options] = mountAsync.mock.calls.at(index) ?? [];
	return options;
}

describe("Diagram", () => {
	beforeEach(() => {
		Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
	});

	afterEach(() => {
		mountAsync.mockReset();
	});

	it("shows an announced skeleton until Pele has drawn the diagram", async () => {
		mountAsync.mockResolvedValue(stubMounted());
		const { container, getByRole } = render(<Diagram source={SOURCE} />, { wrapper: UiKitTestProviders });

		const figure = container.querySelector('[data-slot="diagram"]');
		expect(figure?.getAttribute("data-status")).toBe("loading");
		expect(getByRole("status").textContent).toContain("Loading diagram…");

		await act(async () => {
			lastOptions()?.onRender?.({ svg: "<svg></svg>", width: 1, height: 1, links: [], type: "flowchart", mermaidType: "flowchart-v2" });
			await Promise.resolve();
		});

		expect(figure?.getAttribute("data-status")).toBe("ready");
		expect(container.querySelector('[role="status"]')).toBeNull();
	});

	it("hands Pele the source, a unique SVG id prefix and the kit's zoom labels", () => {
		mountAsync.mockResolvedValue(stubMounted());
		const { container } = render(
			<>
				<Diagram source={SOURCE} />
				<Diagram source={SOURCE} />
			</>,
			{ wrapper: UiKitTestProviders },
		);

		const [canvas, text] = mountAsync.mock.calls.at(0) ?? [];
		expect(canvas).toBe(container.querySelector('[data-slot="diagram-canvas"]'));
		expect(text).toBe(SOURCE);
		expect(lastOptions()?.zoom).toStrictEqual({ labels: { zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Reset zoom" } });
		const firstPrefix = optionsOfCall(0)?.idPrefix;
		expect(firstPrefix).toMatch(/^diagram-[\w-]+$/u);
		expect(firstPrefix).not.toBe(optionsOfCall(-1)?.idPrefix);
	});

	it("re-measures labels once the web fonts have loaded", async () => {
		const mounted = stubMounted();
		mountAsync.mockResolvedValue(mounted);
		render(<Diagram source={SOURCE} />, { wrapper: UiKitTestProviders });

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(mounted.refresh).toHaveBeenCalled();
	});

	it("reports an error when Pele cannot draw the source", async () => {
		mountAsync.mockResolvedValue(stubMounted());
		const { container } = render(<Diagram source="not a diagram" />, { wrapper: UiKitTestProviders });

		await act(async () => {
			lastOptions()?.onError?.(new Error("syntax"));
			await Promise.resolve();
		});

		expect(container.querySelector('[data-slot="diagram"]')?.getAttribute("data-status")).toBe("error");
	});

	it("reports an error when the renderer fails to load", async () => {
		mountAsync.mockRejectedValue(new Error("chunk failed"));
		const { container } = render(<Diagram source={SOURCE} />, { wrapper: UiKitTestProviders });

		await act(async () => {
			await Promise.resolve();
		});

		expect(container.querySelector('[data-slot="diagram"]')?.getAttribute("data-status")).toBe("error");
	});

	it("releases Pele's resize observer and zoom when it unmounts", async () => {
		const mounted = stubMounted();
		mountAsync.mockResolvedValue(mounted);
		const { unmount } = render(<Diagram source={SOURCE} />, { wrapper: UiKitTestProviders });
		await act(async () => {
			await Promise.resolve();
		});

		unmount();

		expect(mounted.destroy).toHaveBeenCalled();
	});

	it("applies the token theme and renders a caption", () => {
		mountAsync.mockResolvedValue(stubMounted());
		const { container, getByText } = render(<Diagram source={SOURCE} caption="How it flows" />, { wrapper: UiKitTestProviders });

		const figure = container.querySelector<HTMLElement>('[data-slot="diagram"]');
		expect(figure?.style.getPropertyValue("--pele-line")).toBe("var(--muted-foreground)");
		expect(getByText("How it flows").tagName).toBe("FIGCAPTION");
	});
});
