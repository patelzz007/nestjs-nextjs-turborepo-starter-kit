import { z } from "zod";

import type { Manifest } from "./manifest.ts";
import { siteUrlFor } from "./slug.ts";

/**
 * `docs/sync/redirects.json`: every old address of a page that moved, built from the manifest's slug history.
 * The site answers each with a permanent redirect. A list that would mislead a reader never reaches the site:
 * `redirectProblems` is a workspace-level check, so a bad list blocks the batch.
 */

export const RedirectSchema = z.object({ from: z.string().min(1), to: z.string().min(1) }).strict();
export type Redirect = z.output<typeof RedirectSchema>;
export const RedirectsSchema = z.array(RedirectSchema);

const JSON_INDENT = "\t";

/** Every redirect the manifest implies, sorted by old address. */
export function buildRedirects(manifest: Manifest): readonly Redirect[] {
	return manifest.entries
		.flatMap((entry) => {
			const to = siteUrlFor(entry.slug, entry.collection);
			return entry.previousSlugs.map((slug): Redirect => ({ from: siteUrlFor(slug, entry.collection), to }));
		})
		.sort((left, right) => (left.from < right.from ? -1 : Number(left.from > right.from)));
}

/** What is wrong with a redirect list, in words; empty when it is safe to publish. */
export function redirectProblems(redirects: readonly Redirect[], manifest: Manifest): readonly string[] {
	const live = new Set(manifest.entries.map((entry) => siteUrlFor(entry.slug, entry.collection)));
	const seen = new Set<string>();
	return redirects.flatMap((redirect): string[] => {
		const problems: string[] = [];
		if (seen.has(redirect.from)) {
			problems.push(`Two pages claim the old address ${redirect.from}.`);
		}
		seen.add(redirect.from);
		if (redirect.from === redirect.to) {
			problems.push(`${redirect.from} redirects to itself.`);
		} else if (live.has(redirect.from)) {
			problems.push(`${redirect.from} is a live page, so it cannot also redirect to ${redirect.to}.`);
		}
		if (!live.has(redirect.to)) {
			problems.push(`${redirect.from} redirects to ${redirect.to}, which is not a page.`);
		}
		return problems;
	});
}

export function serialiseRedirects(redirects: readonly Redirect[]): string {
	return `${JSON.stringify(redirects, null, JSON_INDENT)}\n`;
}
