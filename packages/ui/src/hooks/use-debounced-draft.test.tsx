// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedDraft, type DebouncedDraft } from "./use-debounced-draft";

const DELAY_MS = 150;

interface DraftProps {
	readonly value: string;
	readonly onCommit: (value: string) => void;
}

function setup(initial: DraftProps): { readonly result: { readonly current: DebouncedDraft }; readonly rerender: (props: DraftProps) => void } {
	return renderHook(({ value, onCommit }: DraftProps) => useDebouncedDraft({ value, onCommit, delayMs: DELAY_MS }), { initialProps: initial });
}

beforeEach((): void => {
	vi.useFakeTimers();
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

describe("useDebouncedDraft", () => {
	it("commits a typed draft only after the delay", () => {
		const onCommit = vi.fn<(value: string) => void>();
		const { result } = setup({ value: "", onCommit });

		act(() => {
			result.current.setDraft("caf");
		});
		expect(onCommit).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(onCommit).toHaveBeenCalledWith("caf");
	});

	it("commitNow commits at once and cancels the pending debounced commit", () => {
		const onCommit = vi.fn<(value: string) => void>();
		const { result } = setup({ value: "", onCommit });

		act(() => {
			result.current.setDraft("latte");
		});
		act(() => {
			result.current.commitNow("");
		});
		act(() => {
			vi.advanceTimersByTime(DELAY_MS * 2);
		});

		expect(result.current.draft).toBe("");
		expect(onCommit).not.toHaveBeenCalledWith("latte");
	});

	it("commitNow writes a different value immediately, exactly once", () => {
		const onCommit = vi.fn<(value: string) => void>();
		const { result } = setup({ value: "mocha", onCommit });

		act(() => {
			result.current.commitNow("");
		});
		act(() => {
			vi.advanceTimersByTime(DELAY_MS * 2);
		});

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("");
	});

	it("replaces the draft during render when the committed value changes elsewhere", () => {
		const onCommit = vi.fn<(value: string) => void>();
		const { result, rerender } = setup({ value: "tea", onCommit });

		rerender({ value: "", onCommit });

		expect(result.current.draft).toBe("");
	});

	it("keeps characters typed after a commit when the owner echoes that commit back", () => {
		const onCommit = vi.fn<(value: string) => void>();
		const { result, rerender } = setup({ value: "", onCommit });

		act(() => {
			result.current.setDraft("fl");
		});
		act(() => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		act(() => {
			result.current.setDraft("flat");
		});
		rerender({ value: "fl", onCommit });

		expect(result.current.draft).toBe("flat");
	});
});
