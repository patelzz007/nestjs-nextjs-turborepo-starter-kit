/**
 * The mobile app's Maestro flows (apps/mobile/.maestro) tap the app's tabs by id (`tab-<name>`, app-tab-bar.tsx), never
 * by label. Android's navigation bar has its own "Home" button with that accessibility label: a flow that tapped
 * "Home" sometimes pressed it instead of the tab, sent the app to the background, and failed the mobile nightly
 * (2026-11-21).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parseAllDocuments } from "yaml";
import { z } from "zod";

const FLOWS_DIR = path.resolve(import.meta.dirname, "../../../../../../apps/mobile/.maestro");

/** The tab bar's labels in English (apps/mobile/src/features/navigation/navigation-labels.ts → headings). */
const TAB_LABELS: readonly string[] = ["Home", "Analytics", "Search", "Profile", "Settings"];

/** A command: an object (`tapOn: …`) or a bare name (`back`, `hideKeyboard`). */
const CommandSchema = z.union([z.string(), z.looseObject({})]);
const NestedCommandsSchema = z.looseObject({ commands: z.array(CommandSchema) });
const TapByTextSchema = z.string();

/** Every `tapOn` target written as text, in this command and the commands it nests (runFlow, retry, repeat). */
function tappedTexts(command: z.infer<typeof CommandSchema>): string[] {
	const parsed = z.looseObject({}).safeParse(command);
	if (!parsed.success) {
		return []; // a bare command taps nothing
	}
	return Object.entries(parsed.data).flatMap(([key, value]): string[] => {
		const text = TapByTextSchema.safeParse(value);
		if (key === "tapOn" && text.success) {
			return [text.data];
		}
		const nested = NestedCommandsSchema.safeParse(value);
		return nested.success ? nested.data.commands.flatMap(tappedTexts) : [];
	});
}

/** The flow files of one folder: config.yaml is Maestro's workspace config, not a flow. */
function flowsIn(dir: string): string[] {
	return readdirSync(dir)
		.filter((name: string): boolean => name.endsWith(".yaml") && name !== "config.yaml")
		.map((name: string): string => path.join(dir, name));
}

/** A flow's commands: the document after its `---` (the one before it is the flow's header). */
function commandsOf(file: string): z.infer<typeof CommandSchema>[] {
	const documents = parseAllDocuments(readFileSync(file, "utf8"));
	return z.array(CommandSchema).parse(documents.at(-1)?.toJS());
}

/** Whether a `tapOn` text would match a tab's label (plain or as an anchored pattern). */
function isTabLabel(text: string): boolean {
	return TAB_LABELS.some((label: string): boolean => text === label || text === `^${label}$`);
}

describe("the mobile Maestro flows", () => {
	const flows = [...flowsIn(FLOWS_DIR), ...flowsIn(path.join(FLOWS_DIR, "subflows"))];

	it("are found", () => {
		expect(flows.length).toBeGreaterThan(0);
	});

	it.each(flows.map((file: string): [string, string] => [path.relative(FLOWS_DIR, file), file]))("%s taps tabs by id, never by label", (_name, file) => {
		const byLabel = commandsOf(file).flatMap(tappedTexts).filter(isTabLabel);

		expect(byLabel).toEqual([]);
	});

	it("reads a tap by text inside nested commands, and leaves a tap by id alone", () => {
		const command = { runFlow: { commands: [{ tapOn: "Home" }, "back", { retry: { commands: [{ tapOn: "^Settings$" }] } }, { tapOn: { id: "tab-index" } }] } };

		expect(tappedTexts(command).filter(isTabLabel)).toEqual(["Home", "^Settings$"]);
	});

	it("does not mistake a label that only contains a tab's name for the tab", () => {
		expect(isTabLabel("Home settings")).toBe(false);
		expect(isTabLabel("Settings")).toBe(true);
	});
});
