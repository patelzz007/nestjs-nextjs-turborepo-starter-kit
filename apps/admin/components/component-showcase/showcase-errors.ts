/**
 * The catalog names a component the generated feature sets do not have: its
 * folder (`components/component-showcase/examples/<slug>`) is missing, or
 * `pnpm showcase:generate` was not re-run after adding it. A programming
 * error, surfaced loudly rather than rendering an empty page.
 */
export class MissingShowcaseFeaturesError extends Error {
	public constructor(public readonly slug: string) {
		super(`The showcase has no features for "${slug}": add components/component-showcase/examples/${slug}/features.json and run \`pnpm showcase:generate\`.`);
		this.name = "MissingShowcaseFeaturesError";
	}
}
