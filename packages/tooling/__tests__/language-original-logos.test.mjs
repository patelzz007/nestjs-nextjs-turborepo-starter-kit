// The mobile app bundles the original (full-colour) logos of the languages GitHub reports as SVG
// documents copied from devicon (apps/mobile/src/contexts/integrations-github/github/language-original-logos.ts).
// This test reads each entry and checks it byte for byte against the devicon package the app pins as a
// devDependency, so an entry cannot drift from its source. It lives here, on Node, because reading files
// is not something Hermes-bound code may do.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const MOBILE_ROOT = path.join(REPO_ROOT, "apps/mobile");
const LOGOS_FILE = path.join(MOBILE_ROOT, "src/contexts/integrations-github/github/language-original-logos.ts");
const DEVICON_ICONS = path.join(path.dirname(createRequire(path.join(MOBILE_ROOT, "package.json")).resolve("devicon/package.json")), "icons");

/** What a backslash escape stands for in a string literal (any other escaped character is itself). */
const ESCAPES = new Map([
	["n", "\n"],
	["t", "\t"],
	["r", "\r"],
]);

/** The text of a JavaScript string literal in either quote style (the formatter picks the one with fewer escapes). */
function stringLiteralValue(literal) {
	return literal.slice(1, -1).replace(/\\(.)/gu, (_escape, character) => ESCAPES.get(character) ?? character);
}

/** Every `[name, { file, xml }]` entry of the logos file: the name, the devicon file and the SVG document. */
function logoEntries(source) {
	const pattern = /\[\s*"(?<name>[^"]+)",\s*\{\s*file:\s*"(?<file>[^"]+)",\s*xml:\s*(?<xml>'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*\},?\s*\]/gu;
	return [...source.matchAll(pattern)].map((match) => ({ name: match.groups.name, file: match.groups.file, xml: stringLiteralValue(match.groups.xml) }));
}

describe("the mobile app's original language logos", () => {
	const entries = logoEntries(readFileSync(LOGOS_FILE, "utf8"));

	it("finds the entries it checks", () => {
		expect(entries.length).toBeGreaterThan(40);
	});

	it.each(entries.map((entry) => [entry.name, entry]))("draws %s exactly as devicon's file", (_name, entry) => {
		expect(entry.xml).toBe(readFileSync(path.join(DEVICON_ICONS, entry.file), "utf8").trim());
	});

	it("uses a language's original logo, and its plain one only when devicon draws no original", () => {
		const plainWithAnOriginal = entries
			.filter((entry) => entry.file.endsWith("-plain.svg"))
			.filter((entry) => {
				const original = entry.file.replace(/-plain\.svg$/u, "-original.svg");
				try {
					readFileSync(path.join(DEVICON_ICONS, original));
					return true;
				} catch {
					return false;
				}
			});
		expect(entries.every((entry) => /-(?:original|plain)\.svg$/u.test(entry.file))).toBe(true);
		expect(plainWithAnOriginal.map((entry) => entry.name)).toStrictEqual([]);
	});
});
