import { act, renderHook } from "@testing-library/react-native";

import { useCursorPages } from "../use-cursor-pages";

describe("useCursorPages", () => {
	it("starts on the first page, appends each new cursor once, and resets to the first page", async () => {
		const { result } = await renderHook(() => useCursorPages());
		expect(result.current.cursors).toEqual([undefined]);

		await act((): void => {
			result.current.loadMore("cursor-2");
		});
		await act((): void => {
			result.current.loadMore("cursor-2");
		});
		await act((): void => {
			result.current.loadMore("cursor-3");
		});
		expect(result.current.cursors).toEqual([undefined, "cursor-2", "cursor-3"]);

		await act((): void => {
			result.current.reset();
		});
		expect(result.current.cursors).toEqual([undefined]);
	});
});
