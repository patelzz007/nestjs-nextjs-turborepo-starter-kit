// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../../testing/ui-kit-test-providers";
import { Cascader } from "../cascader";
import { type CascaderChildrenResult, CascaderLoaderClient, useCascaderLoadState } from "../cascader-async";
import { buildCascaderIndex, CASCADER_ROOT_KEY } from "../cascader-lib";
import { openPicker, optionNames, pressRow, type Produce, ProducePicker, searchField, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderLoadContext, CascaderNode } from "../cascader-types";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const ROOTS: readonly CascaderNode<Produce>[] = [
	{ value: "fruit", label: "Fruit", hasChildren: true },
	{ value: "nuts", label: "Nuts", hasChildren: true },
];

const FRUIT: readonly CascaderNode<Produce>[] = [{ value: "apple", label: "Apple", data: { kcal: 52 } }];

/** Lets the loader's `Promise.resolve().then(...)` hand-off run: a load starts one microtask after its ask. */
async function flushLoads(): Promise<void> {
	await act(async (): Promise<void> => {
		await Promise.resolve();
	});
}

/** A loader the test settles by hand: each call parks its resolve/reject. */
function createManualLoader(): {
	readonly getChildren: (node: CascaderNode<Produce> | null, context: CascaderLoadContext) => Promise<CascaderChildrenResult<Produce>>;
	readonly calls: (string | null)[];
	readonly settle: (result: CascaderChildrenResult<Produce>) => void;
	readonly fail: (error: Error) => void;
} {
	const calls: (string | null)[] = [];
	const pending: { resolve: (result: CascaderChildrenResult<Produce>) => void; reject: (error: Error) => void }[] = [];
	return {
		calls,
		getChildren: (node: CascaderNode<Produce> | null): Promise<CascaderChildrenResult<Produce>> => {
			calls.push(node === null ? null : node.value);
			return new Promise((resolve: (result: CascaderChildrenResult<Produce>) => void, reject: (error: Error) => void): void => {
				pending.push({ resolve, reject });
			});
		},
		settle: (result: CascaderChildrenResult<Produce>): void => {
			pending.shift()?.resolve(result);
		},
		fail: (error: Error): void => {
			pending.shift()?.reject(error);
		},
	};
}

describe("async loading through the caller's getChildren", (): void => {
	it("fetches the root on open, then a pressed branch before drilling in", async (): Promise<void> => {
		const loader = createManualLoader();
		render(<ProducePicker items={[]} getChildren={loader.getChildren} />, { wrapper: UiKitTestProviders });
		openPicker();
		await flushLoads();
		expect(loader.calls).toEqual([null]);
		await act(async (): Promise<void> => {
			loader.settle(ROOTS);
			await Promise.resolve();
		});
		expect(optionNames()).toEqual(["Fruit", "Nuts"]);

		pressRow(/Fruit/);
		await flushLoads();
		expect(loader.calls).toEqual([null, "fruit"]);
		// Load BEFORE you move: the old level stays on screen while the branch loads.
		expect(optionNames()).toEqual(["Fruit", "Nuts"]);
		expect(screen.getByRole("option", { name: /Fruit/ }).querySelector('[data-slot="cascader-item-chevron"]')?.getAttribute("data-state")).toBe("loading");

		await act(async (): Promise<void> => {
			loader.settle(FRUIT);
			await Promise.resolve();
		});
		await waitFor((): void => {
			expect(optionNames()).toEqual(["Apple"]);
		});
	});

	it("reports a rejected load, keeps the level, and retries on press", async (): Promise<void> => {
		const loader = createManualLoader();
		const onLoadError = vi.fn();
		render(<ProducePicker items={ROOTS} getChildren={loader.getChildren} onLoadError={onLoadError} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressRow(/Nuts/);
		await flushLoads();
		const failure = new Error("offline");
		await act(async (): Promise<void> => {
			loader.fail(failure);
			await Promise.resolve();
		});
		expect(onLoadError).toHaveBeenCalledWith(failure, { parent: "nuts", reason: "level" });
		expect(optionNames()).toEqual(["Fruit", "Nuts"]);
		expect(screen.getByRole("status").textContent).toContain("Could not load items.");

		pressRow(/Nuts/);
		await flushLoads();
		expect(loader.calls).toEqual(["nuts", "nuts"]);
		await act(async (): Promise<void> => {
			loader.settle([{ value: "almond", label: "Almond" }]);
			await Promise.resolve();
		});
		await waitFor((): void => {
			expect(optionNames()).toEqual(["Almond"]);
		});
	});

	it("pages a level through the paging row", async (): Promise<void> => {
		const loader = createManualLoader();
		render(<ProducePicker items={[]} getChildren={loader.getChildren} />, { wrapper: UiKitTestProviders });
		openPicker();
		await flushLoads();
		await act(async (): Promise<void> => {
			loader.settle({ items: [{ value: "fruit", label: "Fruit" }], nextCursor: "page-2" });
			await Promise.resolve();
		});
		const more = screen.getAllByRole("option").at(-1);
		expect(more?.getAttribute("data-more")).toBe("");
		expect(more?.textContent).toContain("Load more");
		pressRow(/Load more/);
		await flushLoads();
		expect(loader.calls).toEqual([null, null]);
		await act(async (): Promise<void> => {
			loader.settle({ items: [{ value: "nuts", label: "Nuts" }] });
			await Promise.resolve();
		});
		expect(optionNames()).toEqual(["Fruit", "Nuts"]);
	});

	it("runs the caller's onSearch after the debounce and lists its hits", async (): Promise<void> => {
		const onSearch = vi.fn((): readonly CascaderNode<Produce>[] => [{ value: "kale", label: "Kale" }]);
		render(<ProducePicker items={ROOTS} onSearch={onSearch} searchDebounce={0} />, { wrapper: UiKitTestProviders });
		openPicker();
		act((): void => {
			fireEvent.change(searchField(), { target: { value: "ka" } });
		});
		await waitFor((): void => {
			expect(optionNames()).toEqual(["Kale"]);
		});
		expect(onSearch).toHaveBeenCalledWith("ka", expect.objectContaining({ path: [] }));
	});

	it("resolves a server-supplied value into a path for the closed trigger", async (): Promise<void> => {
		const resolveValue = vi.fn((): readonly CascaderNode<Produce>[] => [
			{ value: "fruit", label: "Fruit" },
			{ value: "fig", label: "Fig" },
		]);
		render(<ProducePicker items={ROOTS} value="fig" resolveValue={resolveValue} />, { wrapper: UiKitTestProviders });
		await waitFor((): void => {
			expect(screen.getByRole("combobox", { name: "Produce" }).textContent).toContain("Fruit");
		});
		expect(resolveValue).toHaveBeenCalledWith("fig", expect.objectContaining({ reason: "resolve" }));
	});
});

describe("CascaderLoaderClient", (): void => {
	it("ignores a level `items` already fills and dedupes an in-flight ask", (): void => {
		const client = new CascaderLoaderClient<Produce>();
		const getChildren = vi.fn((): readonly CascaderNode<Produce>[] => []);
		client.setOptions({
			base: buildCascaderIndex(ROOTS),
			getChildren,
			onSearch: undefined,
			resolveValue: undefined,
			onLoadError: undefined,
			onLevelSettled: undefined,
			prefetch: false,
			path: [],
			query: "",
		});
		client.ensureLevel(CASCADER_ROOT_KEY, "level");
		client.ensureLevel("fruit", "level");
		client.ensureLevel("fruit", "level");
		expect(client.getSnapshot().store.states.get("fruit")?.loading).toBe(true);
		expect(client.getSnapshot().store.states.has(CASCADER_ROOT_KEY)).toBe(false);
		client.invalidateLevel("fruit");
		expect(client.getSnapshot().store.states.has("fruit")).toBe(false);
		client.dispose();
	});
});

describe("useCascaderLoadState", (): void => {
	it("reads a level's state, null when never fetched", (): void => {
		render(
			<Cascader items={ROOTS}>
				<LoadStateProbe />
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByTestId("state").textContent).toBe("none");
	});
});

function LoadStateProbe(): React.JSX.Element {
	const state = useCascaderLoadState("fruit");
	return <span data-testid="state">{state === null ? "none" : "some"}</span>;
}
