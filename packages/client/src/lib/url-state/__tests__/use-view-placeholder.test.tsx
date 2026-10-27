// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useIsOtherViewPlaceholder, type ViewPlaceholderQuery } from "../use-view-placeholder";

interface Props {
	readonly view: string;
	readonly query: ViewPlaceholderQuery;
}

const ANSWERED: ViewPlaceholderQuery = { isSuccess: true, isPlaceholderData: false };
const PLACEHOLDER: ViewPlaceholderQuery = { isSuccess: true, isPlaceholderData: true };

function renderView(initial: Props): ReturnType<typeof renderHook<boolean, Props>> {
	return renderHook(({ view, query }: Props) => useIsOtherViewPlaceholder(view, query), { initialProps: initial });
}

afterEach((): void => {
	cleanup();
});

describe("useIsOtherViewPlaceholder", () => {
	it("is false for the view's own answer", () => {
		const { result } = renderView({ view: "live", query: ANSWERED });
		expect(result.current).toBe(false);
	});

	it("is true while another view's answer stands in for the new view", () => {
		const { result, rerender } = renderView({ view: "live", query: ANSWERED });
		rerender({ view: "drafts", query: PLACEHOLDER });
		expect(result.current).toBe(true);
	});

	it("is false again once the new view is answered", () => {
		const { result, rerender } = renderView({ view: "live", query: ANSWERED });
		rerender({ view: "drafts", query: PLACEHOLDER });
		rerender({ view: "drafts", query: ANSWERED });
		expect(result.current).toBe(false);
	});

	it("keeps the previous page as the placeholder while paging within one view", () => {
		const { result, rerender } = renderView({ view: "live", query: ANSWERED });
		rerender({ view: "live", query: PLACEHOLDER });
		expect(result.current).toBe(false);
	});

	it("is false while there is nothing on screen yet", () => {
		const { result } = renderView({ view: "live", query: { isSuccess: false, isPlaceholderData: false } });
		expect(result.current).toBe(false);
	});
});
