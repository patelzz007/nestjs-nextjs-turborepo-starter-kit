import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DARK_THEME, THEMES } from "../semantic";
import { TOKEN_SOURCE } from "../source";
import { paletteColor } from "../value";
import { GENERATE_COMMAND } from "./common";
import { generateTokenStylesheets } from "./generate";
import { findStaleStylesheets, findUnexpectedGeneratedFiles } from "./staleness";

const GENERATED_DIRECTORY = new URL("../../generated/", import.meta.url);

function readCommitted(fileName: string): Uint8Array | undefined {
	const file = new URL(fileName, GENERATED_DIRECTORY);
	return existsSync(file) ? readFileSync(file) : undefined;
}

describe("the committed generated files", () => {
	it(`matches what the token source generates now (if this fails, run \`${GENERATE_COMMAND}\` and commit the result)`, () => {
		expect(findStaleStylesheets(generateTokenStylesheets(TOKEN_SOURCE), readCommitted)).toStrictEqual([]);
	});

	it("holds no file the generator does not produce", () => {
		expect(findUnexpectedGeneratedFiles(generateTokenStylesheets(TOKEN_SOURCE), readdirSync(GENERATED_DIRECTORY))).toStrictEqual([]);
	});
});

describe("findStaleStylesheets", () => {
	const expected = generateTokenStylesheets(TOKEN_SOURCE);

	it("reports nothing when every committed file matches", () => {
		expect(findStaleStylesheets(expected, readCommitted)).toStrictEqual([]);
	});

	it("reports a hand edit of a generated file, naming the command to fix it", () => {
		const handEdited = (fileName: string): Uint8Array | undefined => {
			const committed = readCommitted(fileName);
			return fileName === "web.css" && committed !== undefined
				? new TextEncoder().encode(new TextDecoder().decode(committed).replace("--card: var(--palette-neutral-0);", "--card: white;"))
				: committed;
		};

		expect(findStaleStylesheets(expected, handEdited)).toStrictEqual([
			`generated/web.css is out of date with packages/tokens/src (or was edited by hand). Run \`${GENERATE_COMMAND}\` and commit the result.`,
		]);
	});

	it("reports every output a token change affects until it is regenerated", () => {
		const changed = generateTokenStylesheets({ ...TOKEN_SOURCE, themes: { ...THEMES, dark: { ...DARK_THEME, card: paletteColor("ink", "800") } } });

		expect(findStaleStylesheets(changed, readCommitted).map((problem) => problem.split(" ").at(0))).toStrictEqual(["generated/web.css", "generated/mobile.css"]);
	});

	it("reports a committed file that is missing", () => {
		expect(findStaleStylesheets(expected, () => undefined)).toHaveLength(expected.length);
	});
});

describe("findUnexpectedGeneratedFiles", () => {
	it("names a leftover file in generated/", () => {
		expect(findUnexpectedGeneratedFiles(generateTokenStylesheets(TOKEN_SOURCE), ["web.css", "tokens-old.css"])).toStrictEqual([
			`generated/tokens-old.css is not produced by the generator. Delete it, or add it to the generator, then run \`${GENERATE_COMMAND}\`.`,
		]);
	});
});
