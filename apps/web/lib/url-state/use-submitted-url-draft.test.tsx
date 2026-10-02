// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { UrlDraft } from "@workspace/client/lib/url-state/use-url-draft";
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
		expect(setup("latte").result.current[0]).toBe("latte");
		expect(setup(undefined).result.current[0]).toBe("");
	});

	it("keeps what the user types while the URL is unchanged", () => {
		const { result, rerender } = setup("latte");
		act((): void => {
			result.current[1]("latte art");
		});
		rerender({ value: "latte" });
		expect(result.current[0]).toBe("latte art");
	});

	it("resets to the URL value when the URL changes (submit echo, back/forward, clear)", () => {
		const { result, rerender } = setup("latte");
		act((): void => {
			result.current[1]("  spa ");
		});
		rerender({ value: "spa" });
		expect(result.current[0]).toBe("spa");

		rerender({ value: undefined });
		expect(result.current[0]).toBe("");
	});
});
