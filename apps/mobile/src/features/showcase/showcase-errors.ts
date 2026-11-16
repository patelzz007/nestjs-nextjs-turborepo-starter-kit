/**
 * The catalog names a component the generated feature sets do not have: its
 * folder (`features/showcase/examples/<slug>`) is missing, or the generator
 * was not re-run after adding it. A programming error, surfaced loudly rather
 * than rendering an empty screen.
 */
export class MissingShowcaseFeaturesError extends Error {
	public constructor(public readonly slug: string) {
		super(`The showcase has no features for "${slug}": add features/showcase/examples/${slug}/features.json and run the showcase generator.`);
		this.name = "MissingShowcaseFeaturesError";
	}
}
