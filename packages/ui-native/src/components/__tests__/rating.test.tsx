import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Rating, starFills } from "../rating";

describe("starFills", () => {
	it("draws whole and half stars, rounding to the nearest half", () => {
		expect(starFills(3.5, 5)).toStrictEqual(["full", "full", "full", "half", "empty"]);
		expect(starFills(4.3, 5)).toStrictEqual(["full", "full", "full", "full", "half"]);
		expect(starFills(0, 3)).toStrictEqual(["empty", "empty", "empty"]);
	});
});

describe("Rating", () => {
	it("is a read-only picture of the score unless it can be changed, and prints the value when asked", async () => {
		await render(<Rating value={4.5} showValue testID="rating" />);
		const rating = screen.getByTestId("rating");
		expect(rating).toHaveProp("accessibilityRole", "image");
		expect(rating).toHaveProp("accessibilityLabel", "4.5 of 5 stars");
		expect(screen.getByText("4.5")).toBeOnTheScreen();
	});

	it("is picked by a star's tap, or by stepping for a screen reader", async () => {
		const onChange = jest.fn();
		await render(<Rating value={2} onChange={onChange} accessibilityLabel="Your rating" testID="rating" />);
		const rating = screen.getByTestId("rating");
		expect(rating).toHaveProp("accessibilityRole", "adjustable");
		expect(rating).toHaveProp("accessibilityLabel", "Your rating, 2 of 5 stars");
		await fireEvent(rating, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).toHaveBeenLastCalledWith(3);
		await fireEvent(rating, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onChange).toHaveBeenLastCalledWith(1);
	});

	it("steps by half a star with allowHalf, within its range", async () => {
		const onChange = jest.fn();
		await render(<Rating value={5} onChange={onChange} allowHalf testID="rating" />);
		const rating = screen.getByTestId("rating");
		await fireEvent(rating, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).toHaveBeenLastCalledWith(5);
		await fireEvent(rating, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onChange).toHaveBeenLastCalledWith(4.5);
	});

	it("cannot be picked while disabled, and forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Rating ref={ref} value={3} onChange={jest.fn()} disabled testID="rating" />);
		expect(screen.getByTestId("rating")).toHaveProp("accessibilityRole", "image");
		expect(ref.current).not.toBeNull();
	});
});
