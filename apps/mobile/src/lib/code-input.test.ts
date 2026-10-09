import { sanitizeCodeInput } from "./code-input";

describe("sanitizeCodeInput", () => {
	it("keeps digits only, at most six", () => {
		expect(sanitizeCodeInput("123 456")).toBe("123456");
		expect(sanitizeCodeInput("12a3-4")).toBe("1234");
		expect(sanitizeCodeInput("12345678")).toBe("123456");
		expect(sanitizeCodeInput("")).toBe("");
	});
});
