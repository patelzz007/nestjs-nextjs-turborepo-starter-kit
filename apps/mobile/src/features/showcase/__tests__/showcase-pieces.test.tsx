import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";
import { Linking, Text } from "react-native";

import { codeLinesOf, loadHighlightedCode } from "../feature-code";
import { anchorOf } from "../showcase-anchor";
import { codeRoleAt, decodeHighlightedCode, TOKEN_SEPARATOR } from "../showcase-code";
import { showcaseHrefOf } from "../showcase-links";
import { ShowcaseMarkdown } from "../showcase-markdown";
import { SHOWCASE_ROUTES } from "../showcase-routes";
import { groupShowcaseResults } from "../showcase-search";
import type { ShowcaseSearchEntry } from "../showcase-search-index";
import { API_FENCE } from "../showcase-fences";
import { useLoaded } from "../use-loaded";

/** Where a link in the showcase's Markdown takes the reader: recorded, never followed. */
const mockPush = jest.fn<undefined, [string]>();

jest.mock("expo-router", (): { readonly useRouter: () => { readonly push: typeof mockPush } } => ({
	useRouter: (): { readonly push: typeof mockPush } => ({ push: mockPush }),
}));

/** Every block and inline the showcase's Markdown draws. */
const EVERY_KIND = [
	"# Title",
	"",
	"#### Small heading",
	"",
	"Some **bold**, *slanted* and ~~struck~~ text with `code`, a line  ",
	"break and ![a diagram](/diagram.png).",
	"",
	"See [Button](/showcase/button), [MDN](https://developer.mozilla.org) and [mail](mailto:team@example.com).",
	"",
	"3. third",
	"4. fourth",
	"",
	"> Quoted",
	"",
	"---",
	"",
	"![Wide picture](/wide.png)",
	"",
	"| Prop | Type |",
	"| --- | --- |",
	"| size | `md` |",
	"",
	"```tsx",
	"const a = 1;",
	"```",
	"",
	"```",
	"plain",
	"```",
].join("\n");

/** The docs' API fence, drawn by the test as a line of text. */
const API_FENCES = { [API_FENCE]: (): React.ReactNode => <Text>API here</Text> };

describe("anchorOf", () => {
	it("makes a label into a URL-safe id", () => {
		expect(anchorOf("Diagnostics & Actions")).toBe("diagnostics-actions");
		expect(anchorOf("  Before / After ")).toBe("before-after");
	});
});

describe("the code colouring", () => {
	it("decodes the generator's compact lines into tokens with their roles", () => {
		const encoded = `1const${TOKEN_SEPARATOR}0 x = ${TOKEN_SEPARATOR}31\n\n5// done`;
		expect(decodeHighlightedCode(encoded)).toStrictEqual([
			[
				{ role: "keyword", text: "const" },
				{ role: "plain", text: " x = " },
				{ role: "constant", text: "1" },
			],
			[],
			[{ role: "comment", text: "// done" }],
		]);
		expect(codeLinesOf(`2run`)).toStrictEqual([[{ role: "function", text: "run" }]]);
	});

	it("reads an unknown role as plain", () => {
		expect(codeRoleAt(42)).toBe("plain");
	});

	it("loads a component's colouring once, and none for a component it does not have", async () => {
		const first = loadHighlightedCode("button");
		expect(loadHighlightedCode("button")).toBe(first);
		expect((await first).get("button-1")).toEqual(expect.stringContaining("Button"));
		expect((await loadHighlightedCode("no-such-thing")).size).toBe(0);
	});
});

describe("showcaseHrefOf", () => {
	it("opens showcase links in the app, and leaves every other link alone", () => {
		expect(showcaseHrefOf("/showcase")).toBe(SHOWCASE_ROUTES.index);
		expect(showcaseHrefOf("/showcase/button")).toStrictEqual(SHOWCASE_ROUTES.component("button"));
		expect(showcaseHrefOf("/showcase/button/docs")).toStrictEqual(SHOWCASE_ROUTES.docs("button"));
		expect(showcaseHrefOf("/showcase/button#loading-state")).toStrictEqual(SHOWCASE_ROUTES.feature("button", "loading-state"));
		expect(showcaseHrefOf("/showcase/no-such-thing")).toBeNull();
		expect(showcaseHrefOf("https://reui.io")).toBeNull();
	});
});

describe("groupShowcaseResults", () => {
	it("splits results into components and features, leaving empty groups out", () => {
		const entry = (kind: ShowcaseSearchEntry["kind"], key: string): ShowcaseSearchEntry => ({
			kind,
			key,
			title: key,
			componentName: "C",
			familyTitle: "F",
			href: "/",
			haystack: key,
		});
		expect(groupShowcaseResults([entry("feature", "a")]).map((group) => group.title)).toStrictEqual(["Features"]);
		expect(groupShowcaseResults([entry("feature", "a"), entry("component", "b")]).map((group) => group.title)).toStrictEqual(["Components", "Features"]);
	});
});

describe("ShowcaseMarkdown", () => {
	it("draws headings, lists, inline code and links, and the showcase's own fences through the caller", async () => {
		const source = "## Usage\n\nCall `run()` — see [Button](/showcase/button).\n\n- one\n- two\n\n```showcase-api\n\n```";
		await render(<ShowcaseMarkdown source={source} fences={API_FENCES} />);
		expect(screen.getByRole("header", { name: "Usage" })).toBeOnTheScreen();
		expect(screen.getByRole("link", { name: "Button" })).toBeOnTheScreen();
		expect(screen.getByText("API here")).toBeOnTheScreen();
		expect(screen.getByText("one")).toBeOnTheScreen();
	});
});

describe("ShowcaseMarkdown's every kind", () => {
	it("draws each block and inline, and opens a showcase link in the app, a web link in the browser and nothing else", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
		await render(<ShowcaseMarkdown source={EVERY_KIND} testID="markdown" />);
		expect(screen.getByRole("header", { name: "Title" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Small heading" })).toBeOnTheScreen();
		expect(screen.getByText("3.")).toBeOnTheScreen();
		expect(screen.getByText("4.")).toBeOnTheScreen();
		expect(screen.getByText("Quoted")).toBeOnTheScreen();
		expect(screen.getByText("Wide picture")).toBeOnTheScreen();
		expect(screen.getByText("size")).toBeOnTheScreen();
		expect(screen.getByText("plain")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("link", { name: "Button" }));
		expect(mockPush).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("link", { name: "MDN" }));
		expect(openUrl).toHaveBeenCalledWith("https://developer.mozilla.org");
		await fireEvent.press(screen.getByRole("link", { name: "mail" }));
		expect(openUrl).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	it("leaves a web link that no browser opens as it is", async () => {
		jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
		await render(<ShowcaseMarkdown source="[MDN](https://developer.mozilla.org)" />);
		await fireEvent.press(screen.getByRole("link", { name: "MDN" }));
		expect(screen.getByRole("link", { name: "MDN" })).toBeOnTheScreen();
	});
});

describe("useLoaded", () => {
	it("is loading until the load settles, then ready; a failure can be retried", async () => {
		let attempts = 0;
		const load = (): Promise<string> => {
			attempts += 1;
			return attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve("done");
		};
		const { result } = await renderHook(() => useLoaded(load));
		await waitFor((): void => {
			expect(result.current.state.status).toBe("failed");
		});
		await act((): void => {
			result.current.retry();
		});
		await waitFor((): void => {
			expect(result.current.state).toStrictEqual({ status: "ready", value: "done" });
		});
	});
});
