import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";
import type { ViewInstance } from "react-native";

import { CodeBlock, type CodeBlockLine, type CodeBlockLineMark } from "../code-block";

const CODE = "const session = await auth.signIn({ email, password });";
const JSON_CODE = '{\n  "token": "abc"\n}';
const COLOURED: readonly CodeBlockLine[] = [[{ text: "const", role: "keyword" }, { text: " x = " }, { text: "1", role: "constant" }]];

describe("CodeBlock", () => {
	it("shows each line in the code face, selectable, in a column that scrolls sideways", async () => {
		await render(<CodeBlock code={CODE} testID="code" />);

		const line = screen.getByText(CODE);
		expect(line).toHaveProp("selectable", true);
		expect(line).toHaveProp("className", expect.stringContaining("font-code"));
		expect(screen.getByTestId("code-scroll")).toHaveProp("horizontal", true);
	});

	it("draws one line per line of the code, an empty one still a line high", async () => {
		await render(<CodeBlock code={"a\n\nb"} testID="code" />);
		expect(screen.getByText("a")).toBeOnTheScreen();
		expect(screen.getByText("b")).toBeOnTheScreen();
		expect(screen.getByText(" ")).toBeOnTheScreen();
	});

	it("colours each token by its role", async () => {
		await render(<CodeBlock code="const x = 1" lines={COLOURED} />);
		expect(screen.getByText("const")).toHaveProp("className", "text-code-keyword");
		expect(screen.getByText(" x = ")).toHaveProp("className", "text-code-plain");
		expect(screen.getByText("1")).toHaveProp("className", "text-code-constant");
	});

	it("numbers each line in a gutter that is never selected or read out, only when asked", async () => {
		await render(<CodeBlock code={JSON_CODE} showLineNumbers testID="code" />);

		const gutter = screen.getByTestId("code-line-numbers", { includeHiddenElements: true });
		expect(gutter).toHaveTextContent("123");
		expect(gutter).toHaveProp("importantForAccessibility", "no-hide-descendants");
		expect(screen.getByText('  "token": "abc"')).toHaveProp("selectable", true);
	});

	it("numbers from the first line it is given", async () => {
		await render(<CodeBlock code={"a\nb"} showLineNumbers startLine={120} testID="code" />);
		expect(screen.getByTestId("code-line-numbers", { includeHiddenElements: true })).toHaveTextContent("120121");
	});

	it("has no gutter by default", async () => {
		await render(<CodeBlock code={CODE} testID="code" />);
		expect(screen.queryByTestId("code-line-numbers", { includeHiddenElements: true })).toBeNull();
	});

	it("tints a marked line and signs it in the gutter", async () => {
		const marks: readonly CodeBlockLineMark[] = [
			{ line: 1, kind: "removed" },
			{ line: 2, kind: "added" },
		];
		await render(<CodeBlock code={"old\nnew"} lineMarks={marks} showLineNumbers />);
		expect(screen.getByText("old")).toHaveProp("className", expect.stringContaining("bg-destructive-soft"));
		expect(screen.getByText("new")).toHaveProp("className", expect.stringContaining("bg-success-soft"));
		expect(screen.getByText("− 1", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("+ 2", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("wraps long lines instead of scrolling when asked", async () => {
		await render(<CodeBlock code={CODE} wrap testID="code" />);
		expect(screen.queryByTestId("code-scroll")).toBeNull();
	});

	it("folds past maxLines and opens with its button", async () => {
		await render(<CodeBlock code={"1\n2\n3\n4"} maxLines={2} />);
		expect(screen.queryByText("3")).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Show all 4 lines" }));
		expect(screen.getByText("4")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Show fewer lines" })).toHaveProp("accessibilityState", { expanded: true });
	});

	it("does not fold a block within maxLines", async () => {
		await render(<CodeBlock code={"1\n2"} maxLines={2} />);
		expect(screen.queryByRole("button")).toBeNull();
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

	it("takes any of the caller's names, keeping the defaults for the rest", async () => {
		await render(<CodeBlock code={"1\n2"} maxLines={1} onCopy={jest.fn()} labels={{ copy: "Copy snippet" }} />);
		expect(screen.getByRole("button", { name: "Copy snippet" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Show all 2 lines" })).toBeOnTheScreen();
	});

	it("has a muted and a card surface, and a compact size", async () => {
		await render(<CodeBlock code={CODE} testID="muted" />);
		expect(screen.getByTestId("muted")).toHaveProp("className", expect.stringContaining("bg-muted"));

		await render(<CodeBlock code="ls -la" variant="card" size="sm" testID="card" />);
		expect(screen.getByTestId("card")).toHaveProp("className", expect.stringContaining("bg-card"));
		expect(screen.getByText("ls -la")).toHaveProp("className", expect.stringContaining("text-caption"));
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

describe("CodeBlock header, focus, selection, highlights, notes, folds and actions", () => {
	const SOURCE = "function total(items) {\n  let sum = 0;\n  for (const item of items) {\n    sum += item.price;\n  }\n  return sum;\n}";

	it("draws a custom header and footer, dims lines out of focus and marks highlights", async () => {
		await render(
			<CodeBlock
				code={SOURCE}
				header={<Text>checkout.ts</Text>}
				headerEnd={<Text>2 matches</Text>}
				footer={<Text>Footer</Text>}
				focusLines={[2]}
				highlights={[{ text: "sum", kind: "match" }]}
				testID="code"
			/>,
		);
		expect(screen.getByText("checkout.ts")).toBeOnTheScreen();
		expect(screen.getByText("2 matches")).toBeOnTheScreen();
		expect(screen.getByText("Footer")).toBeOnTheScreen();
		expect(screen.getByText("  let sum = 0;", { exact: false }).parent).toBeDefined();
		expect(screen.getAllByText("sum").at(0)).toHaveProp("className", expect.stringContaining("bg-tone-yellow-soft"));
	});

	it("selects lines from the gutter, folds regions from their first line, and runs a line action", async () => {
		const onLinePress = jest.fn();
		const onFoldToggle = jest.fn();
		const act = jest.fn();
		const { rerender } = await render(
			<CodeBlock
				code={SOURCE}
				showLineNumbers
				selectedLines={[2]}
				onLinePress={onLinePress}
				folds={[{ start: 3, end: 5 }]}
				folded={[]}
				onFoldToggle={onFoldToggle}
				lineAction={{ sign: "+", label: (line: number): string => `Add line ${String(line)} to the chat`, onPress: act, lines: [6] }}
				notes={[{ line: 4, text: "price may be undefined", kind: "warning" }]}
			/>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Select line 4" }));
		expect(onLinePress).toHaveBeenCalledWith(4);
		expect(screen.getByRole("button", { name: "Select line 2" })).toHaveProp("accessibilityState", { selected: true });
		await fireEvent.press(screen.getByRole("button", { name: "Fold or unfold from line 3" }));
		expect(onFoldToggle).toHaveBeenCalledWith(3);
		await fireEvent.press(screen.getByRole("button", { name: "Add line 6 to the chat" }));
		expect(act).toHaveBeenCalledWith(6);
		expect(screen.getByText("⚠ price may be undefined")).toBeOnTheScreen();

		await rerender(
			<CodeBlock
				code={SOURCE}
				showLineNumbers
				folds={[{ start: 3, end: 5 }]}
				folded={[3]}
				onFoldToggle={onFoldToggle}
				notes={[
					{ line: 1, text: "entry point" },
					{ line: 2, text: "bad", kind: "error" },
				]}
			/>,
		);
		expect(screen.queryByText("    sum += item.price;")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "⋯ 2 lines" }));
		expect(onFoldToggle).toHaveBeenLastCalledWith(3);
		await rerender(<CodeBlock code={SOURCE} folds={[{ start: 3, end: 5 }]} folded={[3]} />);
		expect(screen.getByText("⋯ 2 lines")).toBeOnTheScreen();
	});

	it("colours terminal tokens with their roles", async () => {
		await render(
			<CodeBlock
				code="ok"
				lines={[
					[
						{ text: "PASS", role: "green" },
						{ text: " 12 tests", role: "dim" },
					],
				]}
			/>,
		);
		expect(screen.getByText("PASS")).toHaveProp("className", expect.stringContaining("text-tone-green"));
	});
});
