// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopyToClipboard } from "./use-copy-to-clipboard";

const RESET_MS = 500;

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined): void {
	Object.defineProperty(window.navigator, "clipboard", { value: writeText === undefined ? undefined : { writeText }, configurable: true });
}

beforeEach((): void => {
	vi.useFakeTimers();
});

afterEach((): void => {
	vi.useRealTimers();
	Reflect.deleteProperty(window.navigator, "clipboard");
});

describe("useCopyToClipboard", () => {
	it("writes the text, flags isCopied, calls onCopy and resets after the timeout", async (): Promise<void> => {
		const writeText = vi.fn((): Promise<void> => Promise.resolve());
		stubClipboard(writeText);
		const onCopy = vi.fn();
		const { result } = renderHook(() => useCopyToClipboard({ timeout: RESET_MS, onCopy }));
		expect(result.current.isCopied).toBe(false);

		await act(async (): Promise<void> => {
			result.current.copyToClipboard("hello");
			await Promise.resolve();
		});
		expect(writeText).toHaveBeenCalledWith("hello");
		expect(result.current.isCopied).toBe(true);
		expect(onCopy).toHaveBeenCalledTimes(1);

		act((): void => {
			vi.advanceTimersByTime(RESET_MS - 1);
		});
		expect(result.current.isCopied).toBe(true);
		act((): void => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.isCopied).toBe(false);
	});

	it("keeps isCopied set when timeout is 0", async (): Promise<void> => {
		stubClipboard(vi.fn((): Promise<void> => Promise.resolve()));
		const { result } = renderHook(() => useCopyToClipboard({ timeout: 0 }));
		await act(async (): Promise<void> => {
			result.current.copyToClipboard("hello");
			await Promise.resolve();
		});
		act((): void => {
			vi.advanceTimersByTime(RESET_MS * RESET_MS);
		});
		expect(result.current.isCopied).toBe(true);
	});

	it("reports a rejected write through onError and stays uncopied", async (): Promise<void> => {
		const denied = new Error("denied");
		stubClipboard(vi.fn((): Promise<void> => Promise.reject(denied)));
		const onCopy = vi.fn();
		const onError = vi.fn();
		const { result } = renderHook(() => useCopyToClipboard({ onCopy, onError }));
		await act(async (): Promise<void> => {
			result.current.copyToClipboard("hello");
			await Promise.resolve();
		});
		expect(onError).toHaveBeenCalledWith(denied);
		expect(onCopy).not.toHaveBeenCalled();
		expect(result.current.isCopied).toBe(false);
	});

	it("does nothing for empty text or without a clipboard", async (): Promise<void> => {
		const writeText = vi.fn((): Promise<void> => Promise.resolve());
		stubClipboard(writeText);
		const { result, rerender } = renderHook(() => useCopyToClipboard());
		await act(async (): Promise<void> => {
			result.current.copyToClipboard("");
			await Promise.resolve();
		});
		expect(writeText).not.toHaveBeenCalled();

		stubClipboard(undefined);
		rerender();
		await act(async (): Promise<void> => {
			result.current.copyToClipboard("hello");
			await Promise.resolve();
		});
		expect(result.current.isCopied).toBe(false);
	});
});
