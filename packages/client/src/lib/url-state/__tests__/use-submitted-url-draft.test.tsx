// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { UrlDraft } from "./use-url-draft";
import { afterEach, describe, expect, it } from "vitest";

import { useSubmittedUrlDraft } from "./use-submitted-url-draft";

interface DraftProps {
	readonly value: string | undefined;
}

function setup(initialValue: string | undefined): { readonly result: { readonly current: UrlDraft }; readonly rerender: (props: DraftProps) => void } {
	const { result, rerender } = renderHook(({ value }: DraftProps) => useSubmittedUrlDraft(value), { initialProps: { value: initialValue } });
	return { result, rerender };
}

afterEach((): void => {
	cleanup();
});

describe("useSubmittedUrlDraft", () => {
	it("starts from the URL value, or empty when the param is absent", () => {
		expect(setup("latte").result.current[LIST_SLOT_INDEX.first]).toBe("latte");
		expect(setup(undefined).result.current[LIST_SLOT_INDEX.first]).toBe("");
	});

	it("keeps what the user types while the URL is unchanged", () => {
		const { result, rerender } = setup("latte");
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]("latte art");
		});
		rerender({ value: "latte" });
		expect(result.current[LIST_SLOT_INDEX.first]).toBe("latte art");
	});

	it("resets to the URL value when the URL changes (submit echo, back/forward, clear)", () => {
		const { result, rerender } = setup("latte");
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]("  spa ");
		});
		rerender({ value: "spa" });
		expect(result.current[LIST_SLOT_INDEX.first]).toBe("spa");

		rerender({ value: undefined });
		expect(result.current[LIST_SLOT_INDEX.first]).toBe("");
	});
});
