import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInput } from "react-native";

import { Textarea, textareaVariants } from "../textarea";

describe("Textarea", () => {
	it("is a multi-line input that starts at the top and reports changes", async () => {
		const onChange = jest.fn();
		await render(<Textarea accessibilityLabel="Comment" value="Looks good" onChange={onChange} />);

		const textarea = screen.getByLabelText("Comment");
		expect(textarea).toHaveProp("multiline", true);
		expect(textarea).toHaveProp("textAlignVertical", "top");
		expect(textarea).toHaveDisplayValue("Looks good");
		await fireEvent.changeText(textarea, "Looks great");
		expect(onChange).toHaveBeenCalledWith("Looks great");
	});

	it("is taller per size", () => {
		expect(textareaVariants({ size: "sm" })).toBe("min-h-20");
		expect(textareaVariants({ size: "md" })).toBe("min-h-28");
		expect(textareaVariants({ size: "lg" })).toBe("min-h-40");
	});

	it("takes no input while disabled, and shows an error unless inactive", async () => {
		await render(<Textarea accessibilityLabel="Comment" value="" onChange={jest.fn()} invalid />);
		expect(String(screen.getByLabelText("Comment").parent?.props.className)).toContain("border-destructive");

		await render(<Textarea accessibilityLabel="Comment" value="" onChange={jest.fn()} invalid disabled />);
		expect(screen.getByLabelText("Comment")).toBeDisabled();
		expect(String(screen.getByLabelText("Comment").parent?.props.className)).not.toContain("border-destructive");
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<TextInput>();
		await render(<Textarea ref={ref} accessibilityLabel="Comment" value="" onChange={jest.fn()} className="min-h-60" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Comment").parent?.props.className);
		expect(className).toContain("min-h-60");
		expect(className).not.toContain("min-h-28");
	});
});
