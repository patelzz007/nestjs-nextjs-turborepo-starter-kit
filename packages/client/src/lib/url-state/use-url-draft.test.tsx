// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trimUrlDraft, useUrlDraft, type UrlDraft } from "./use-url-draft";

const DELAY_MS = 300;

interface DraftProps {
	readonly value: string;
}

function setup(initialValue: string): {
	readonly onCommit: ReturnType<typeof vi.fn<(value: string) => void>>;
	readonly result: { readonly current: UrlDraft };
	readonly rerender: (props: DraftProps) => void;
} {
	const onCommit = vi.fn<(value: string) => void>();
	const { result, rerender } = renderHook(({ value }: DraftProps) => useUrlDraft({ value, onCommit, delayMs: DELAY_MS, normalize: trimUrlDraft }), {
		initialProps: { value: initialValue },
	});
	return { onCommit, result, rerender };
}

beforeEach((): void => {
	vi.useFakeTimers();
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

describe("trimUrlDraft", () => {
	it("trims surrounding whitespace", () => {
		expect(trimUrlDraft("  jane ")).toBe("jane");
	});
});

describe("useUrlDraft", () => {
	it("starts from the URL value and does not commit it back", () => {
		const { result, onCommit } = setup("jane");
		expect(result.current[0]).toBe("jane");
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS * 2);
		});
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("commits the normalized draft once the user stops typing", () => {
		const { result, onCommit } = setup("");
		act((): void => {
			result.current[1]("j");
		});
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS - 1);
			result.current[1]("jane ");
		});
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS - 1);
		});
		expect(onCommit).not.toHaveBeenCalled();
		act((): void => {
			vi.advanceTimersByTime(1);
		});
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("jane");
		expect(result.current[0]).toBe("jane ");
	});

	it("does not commit a draft that only differs from the URL by whitespace", () => {
		const { result, onCommit } = setup("jane");
		act((): void => {
			result.current[1]("jane  ");
		});
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("keeps text typed after a commit when the URL echoes that commit", () => {
		const { result, onCommit, rerender } = setup("");
		act((): void => {
			result.current[1]("jan");
		});
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(onCommit).toHaveBeenCalledWith("jan");
		act((): void => {
			result.current[1]("jane");
		});
		rerender({ value: "jan" });
		expect(result.current[0]).toBe("jane");
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(onCommit).toHaveBeenLastCalledWith("jane");
	});

	it("replaces the draft when the URL changes from outside (back/forward, clear filters)", () => {
		const { result, onCommit, rerender } = setup("jane");
		act((): void => {
			result.current[1]("janet");
		});
		rerender({ value: "" });
		expect(result.current[0]).toBe("");
		act((): void => {
			vi.advanceTimersByTime(DELAY_MS);
		});
		expect(onCommit).not.toHaveBeenCalled();
		rerender({ value: "bob" });
		expect(result.current[0]).toBe("bob");
	});
});
