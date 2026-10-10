import { renderHook } from "@testing-library/react-native";

import { useRisingEdge } from "./use-rising-edge";

describe("useRisingEdge", () => {
	it("fires when the condition turns true — not on mount, not while it stays true", async () => {
		const onRise = jest.fn();
		const { rerender } = await renderHook(
			({ condition }: { readonly condition: boolean }) => {
				useRisingEdge(condition, onRise);
			},
			{ initialProps: { condition: true } },
		);
		expect(onRise).not.toHaveBeenCalled();

		await rerender({ condition: false });
		await rerender({ condition: true });
		await rerender({ condition: true });

		expect(onRise).toHaveBeenCalledTimes(1);
	});
});
