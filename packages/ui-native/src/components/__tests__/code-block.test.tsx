import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { CodeBlock } from "../code-block";

const CODE = "const session = await auth.signIn({ email, password });";

describe("CodeBlock", () => {
	it("shows the code in a monospaced, selectable line that scrolls sideways", async () => {
		await render(<CodeBlock code={CODE} testID="code" />);

		const code = screen.getByText(CODE);
		expect(code).toHaveProp("selectable", true);
		expect(code).toHaveProp("className", expect.stringContaining("font-mono"));
		expect(screen.getByTestId("code-scroll")).toHaveProp("horizontal", true);
	});

	it("has no header when there is nothing to put in it", async () => {
		await render(<CodeBlock code={CODE} />);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("shows the language and the caption", async () => {
		await render(<CodeBlock code={CODE} language="TypeScript" caption="auth.ts" />);
		expect(screen.getByText("TypeScript")).toBeOnTheScreen();
		expect(screen.getByText("auth.ts")).toBeOnTheScreen();
	});

	it("leaves copying to the caller and shows the copied state it reports", async () => {
		const onCopy = jest.fn();
		const { rerender } = await render(<CodeBlock code={CODE} onCopy={onCopy} />);

		await fireEvent.press(screen.getByRole("button", { name: "Copy code" }));
		expect(onCopy).toHaveBeenCalledTimes(1);

		await rerender(<CodeBlock code={CODE} onCopy={onCopy} copied />);
		expect(screen.getByRole("button", { name: "Copied" })).toBeOnTheScreen();
	});

	it("takes the caller's button names", async () => {
		await render(<CodeBlock code={CODE} onCopy={jest.fn()} labels={{ copy: "Copy snippet", copied: "Snippet copied" }} />);
		expect(screen.getByRole("button", { name: "Copy snippet" })).toBeOnTheScreen();
	});

	it("has a muted and a card surface, and a compact size", async () => {
		await render(<CodeBlock code={CODE} testID="muted" />);
		expect(screen.getByTestId("muted")).toHaveProp("className", expect.stringContaining("bg-muted"));

		await render(<CodeBlock code="ls -la" variant="card" size="sm" testID="card" />);
		expect(screen.getByTestId("card")).toHaveProp("className", expect.stringContaining("bg-card"));
		expect(screen.getByText("ls -la")).toHaveProp("className", expect.stringContaining("text-xs"));
	});

	it("merges the caller's className last", async () => {
		await render(<CodeBlock code={CODE} className="mt-2 rounded-xl" testID="code" />);
		const className = String(screen.getByTestId("code").props.className);
		expect(className).toContain("mt-2");
		expect(className).toContain("rounded-xl");
		expect(className).not.toContain("rounded-lg");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<CodeBlock ref={ref} code={CODE} />);
		expect(ref.current).not.toBeNull();
	});
});
