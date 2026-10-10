import * as Haptics from "expo-haptics";

import { playSelectionFeedback } from "./haptics";

describe("playSelectionFeedback", () => {
	it("plays the system selection haptic", () => {
		const selection = jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);

		playSelectionFeedback();

		expect(selection).toHaveBeenCalledTimes(1);
	});

	it("stays silent when the device has no haptics engine", async () => {
		const failure = Promise.reject(new Error("Haptics are not available"));
		jest.spyOn(Haptics, "selectionAsync").mockReturnValue(failure);

		expect(() => {
			playSelectionFeedback();
		}).not.toThrow();
		await expect(failure).rejects.toThrow("Haptics are not available");
	});
});
