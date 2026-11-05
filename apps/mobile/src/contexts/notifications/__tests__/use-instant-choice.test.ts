import { act, renderHook } from "@testing-library/react-native";

import { type InstantChoice, useInstantChoice } from "../use-instant-choice";

interface Props {
	readonly source: object;
	readonly stored: boolean;
}

describe("useInstantChoice", () => {
	it("shows the stored value until a choice is made", async () => {
		const save = jest.fn();
		const { result } = await renderHook((props: Props): InstantChoice => useInstantChoice(props.source, props.stored, save), {
			initialProps: { source: {}, stored: false },
		});

		expect(result.current.shown).toBe(false);
		expect(save).not.toHaveBeenCalled();
	});

	it("shows the choice at once and hands it on to the save", async () => {
		const save = jest.fn();
		const source = {};
		const { result } = await renderHook((props: Props): InstantChoice => useInstantChoice(props.source, props.stored, save), {
			initialProps: { source, stored: false },
		});

		await act((): void => {
			result.current.choose(true);
		});

		expect(result.current.shown).toBe(true);
		expect(save).toHaveBeenCalledWith(true);
	});

	it("holds the choice while the setting is unchanged, and gives way once it is replaced", async () => {
		const save = jest.fn();
		const source = {};
		const { result, rerender } = await renderHook((props: Props): InstantChoice => useInstantChoice(props.source, props.stored, save), {
			initialProps: { source, stored: false },
		});
		await act((): void => {
			result.current.choose(true);
		});

		await rerender({ source, stored: false });
		expect(result.current.shown).toBe(true);

		// The save failed: the setting comes back as it was, in a new object, and the box shows the truth.
		await rerender({ source: {}, stored: false });
		expect(result.current.shown).toBe(false);
	});
});
