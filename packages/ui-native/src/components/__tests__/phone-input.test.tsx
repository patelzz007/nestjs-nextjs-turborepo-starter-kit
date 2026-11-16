import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { countryOfNumber, flagOf, formatPhoneText, PhoneInput, readPhoneText } from "../phone-input";

describe("the phone number helpers", () => {
	it("draw a country's flag from its code", () => {
		expect(flagOf("my")).toBe("🇲🇾");
	});

	it("find the country a number belongs to", () => {
		expect(countryOfNumber("+33612345678")).toBe("FR");
		expect(countryOfNumber("")).toBeNull();
	});

	it("format a number nationally in its own country, internationally elsewhere", () => {
		expect(formatPhoneText("+12133734253", "US")).toBe("(213) 373-4253");
		expect(formatPhoneText("+12133734253", "FR")).toBe("+1 213 373 4253");
		expect(formatPhoneText("", "US")).toBe("");
	});

	it("read a typed number in the picked country, or from its own calling code", () => {
		expect(readPhoneText("0612345678", "FR")).toMatchObject({ value: "+33612345678", country: "FR" });
		expect(readPhoneText("+60 12 345 6789", null)).toMatchObject({ value: "+60123456789", country: "MY" });
		expect(readPhoneText("06", "FR").value).toBe("+336");
		expect(readPhoneText("", "FR").value).toBe("");
	});
});

describe("PhoneInput", () => {
	it("reports the typed number in E.164 and shows the default country", async () => {
		const onChange = jest.fn();
		await render(<PhoneInput value="" onChange={onChange} defaultCountry="FR" accessibilityLabel="Phone" testID="phone" />);
		expect(screen.getByRole("button", { name: "Country: France" })).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByTestId("phone"), "0612345678");
		expect(onChange).toHaveBeenLastCalledWith("+33612345678");
	});

	it("takes its country from the number, and shows the number formatted", async () => {
		await render(<PhoneInput value="+12133734253" onChange={jest.fn()} accessibilityLabel="Phone" testID="phone" />);
		expect(screen.getByRole("button", { name: "Country: United States" })).toBeOnTheScreen();
		expect(screen.getByTestId("phone")).toHaveProp("value", "(213) 373-4253");
	});

	it("picks a country from a searchable sheet, keeping the national number", async () => {
		const onChange = jest.fn();
		await render(<PhoneInput value="+33612345678" onChange={onChange} accessibilityLabel="Phone" testID="phone" />);
		await fireEvent.press(screen.getByRole("button", { name: "Country: France" }));
		const sheet = screen.getByTestId("phone-countries");
		await fireEvent.changeText(within(sheet).getByPlaceholderText("Search countries"), "belgium");
		await fireEvent.press(within(sheet).getByText("🇧🇪  Belgium"));
		expect(onChange).toHaveBeenLastCalledWith("+32612345678");
	});

	it("shows a globe until a country is known, and is selectable but not editable when read only", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<PhoneInput ref={ref} value="" onChange={jest.fn()} readOnly accessibilityLabel="Phone" testID="phone" />);
		expect(screen.getByRole("button", { name: "Country: none" })).toBeDisabled();
		expect(screen.getByTestId("phone")).toHaveProp("editable", false);
		expect(ref.current).not.toBeNull();
	});
});
