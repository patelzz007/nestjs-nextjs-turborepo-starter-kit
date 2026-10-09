// ============================================
// generator/staleness.ts — are the committed files what the source generates?
// ============================================
// Generated CSS is committed (the apps import it without a build step), so a
// token edit without a regenerate — or a hand edit of the output — must fail
// `pnpm run test`, and therefore CI.

import { GENERATE_COMMAND } from "./common";
import type { GeneratedStylesheet } from "./generate";

/**
 * One line per committed file that is missing or differs from what the source
 * generates now; empty when everything is current. `readCommitted` returns the
 * committed contents, or `undefined` when the file does not exist.
 */
export function findStaleStylesheets(expected: readonly GeneratedStylesheet[], readCommitted: (fileName: string) => string | undefined): readonly string[] {
	return expected.flatMap(({ fileName, contents }) => {
		const committed = readCommitted(fileName);
		if (committed === undefined) {
			return [`generated/${fileName} is missing. Run \`${GENERATE_COMMAND}\` and commit the result.`];
		}
		if (committed !== contents) {
			return [`generated/${fileName} is out of date with packages/tokens/src (or was edited by hand). Run \`${GENERATE_COMMAND}\` and commit the result.`];
		}
		return [];
	});
}

/** One line per file in `generated/` the generator does not produce (a leftover a consumer could still import). */
export function findUnexpectedGeneratedFiles(expected: readonly GeneratedStylesheet[], committedFileNames: readonly string[]): readonly string[] {
	const expectedNames = new Set<string>(expected.map(({ fileName }) => fileName));
	return committedFileNames
		.filter((fileName) => !expectedNames.has(fileName))
		.map((fileName) => `generated/${fileName} is not produced by the generator. Delete it, or add it to the generator, then run \`${GENERATE_COMMAND}\`.`);
}
