import { visibleFieldError } from "./form";

describe("visibleFieldError", () => {
	it("hides errors of a field the user has not touched", () => {
		expect(visibleFieldError({ isTouched: false, errors: [{ message: "Required" }] })).toBeUndefined();
	});

	it("shows the first non-empty message of a touched field", () => {
		expect(visibleFieldError({ isTouched: true, errors: [undefined, { message: "" }, { message: "Invalid email" }, { message: "Other" }] })).toBe("Invalid email");
		expect(visibleFieldError({ isTouched: true, errors: [{}] })).toBeUndefined();
		expect(visibleFieldError({ isTouched: true, errors: [] })).toBeUndefined();
	});
});
