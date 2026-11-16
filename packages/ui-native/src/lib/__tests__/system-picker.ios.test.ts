import { IOS_ACTION_SHEET, showSystemPicker } from "../system-picker.ios";

describe("showSystemPicker (iOS)", () => {
	it("shows the action sheet with a cancel row, and reports a pick but not a cancel", () => {
		const onPick = jest.fn();
		const show = jest.spyOn(IOS_ACTION_SHEET, "showActionSheetWithOptions").mockImplementation((_options, callback): void => {
			callback(1);
			callback(2);
		});
		expect(showSystemPicker({ title: "Food", options: ["Apple", "Pear"], cancel: "Cancel", disabledIndices: [0], onPick })).toBe(true);
		expect(show).toHaveBeenCalledWith({ title: "Food", options: ["Apple", "Pear", "Cancel"], cancelButtonIndex: 2, disabledButtonIndices: [0] }, expect.any(Function));
		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onPick).toHaveBeenCalledWith(1);
	});
});
