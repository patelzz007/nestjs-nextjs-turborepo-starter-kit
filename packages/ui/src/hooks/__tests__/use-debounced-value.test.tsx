// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./use-debounced-value";

const DELAY_MS = 300;

beforeEach((): void => {
	vi.useFakeTimers();
});

afterEach((): void => {
	vi.useRealTimers();
});

describe("useDebouncedValue", () => {
	it("starts at the first value", () => {
		const { result } = renderHook(() => useDebouncedValue("a", DELAY_MS));

		expect(result.current).toBe("a");
	});

	it("follows a new value only after it has held still for the delay", () => {
		const { result, rerender } = renderHook(({ value }: { readonly value: string }) => useDebouncedValue(value, DELAY_MS), { initialProps: { value: "a" } });

		rerender({ value: "ab" });
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS - 1);
		});
		expect(result.current).toBe("a");

		act((): void => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe("ab");
	});

	it("restarts the wait on every change, so a burst of typing settles once on the last value", () => {
		const { result, rerender } = renderHook(({ value }: { readonly value: string }) => useDebouncedValue(value, DELAY_MS), { initialProps: { value: "a" } });

		for (const next of ["ab", "abc", "abcd"]) {
			rerender({ value: next });
			act((): void => {
				vi.advanceTimersByTime(DELAY_MS / 2);
			});
		}
		expect(result.current).toBe("a");

		act((): void => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(result.current).toBe("abcd");
	});
});
