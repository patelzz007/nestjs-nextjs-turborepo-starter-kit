// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDataTween } from "../use-data-tween";

const FIRST_ROWS: readonly number[] = [1, 2, 3];
const NEXT_ROWS: readonly number[] = [4, 5, 6];

describe("useDataTween", () => {
	it("tweens the entrance, then draws in place on later renders (a resize)", () => {
		const { result, rerender } = renderHook(({ data }: { readonly data: readonly number[] }) => useDataTween(data), { initialProps: { data: FIRST_ROWS } });
		expect(result.current.isTweening).toBe(true);

		act((): void => {
			result.current.endTween();
		});
		rerender({ data: FIRST_ROWS });

		expect(result.current.isTweening).toBe(false);
	});

	it("tweens again when the data changes, until that tween ends", () => {
		const { result, rerender } = renderHook(({ data }: { readonly data: readonly number[] }) => useDataTween(data), { initialProps: { data: FIRST_ROWS } });
		act((): void => {
			result.current.endTween();
		});

		rerender({ data: NEXT_ROWS });
		expect(result.current.isTweening).toBe(true);

		act((): void => {
			result.current.endTween();
		});
		expect(result.current.isTweening).toBe(false);
	});

	it("keeps the same end callback across renders", () => {
		const { result, rerender } = renderHook(({ data }: { readonly data: readonly number[] }) => useDataTween(data), { initialProps: { data: FIRST_ROWS } });
		const { endTween } = result.current;

		rerender({ data: NEXT_ROWS });

		expect(result.current.endTween).toBe(endTween);
	});
});
