// What the showcase's examples share: sample data and the handlers of
// examples that only show a look. Every example imports the kit exactly as an
// app does; this file only spares them repeating the same sample data.

/** The press handler of an example that only shows how a control looks: pressing it does nothing. */
export function ignorePress(): void {
	// Nothing to do: the example shows the control, not an action.
}

/** A sample person, for avatars and account chips. */
export interface SamplePerson {
	readonly name: string;
	readonly handle: string;
	readonly imageUrl: string | null;
}

export const SAMPLE_PERSON: SamplePerson = { name: "Avery Chen", handle: "@avery", imageUrl: null };

/** The calendar examples' "today" and the range they offer: fixed, so every example reads the same on every day. */
export const SAMPLE_TODAY = "2026-11-15";
export const SAMPLE_MIN_DATE = "2026-01-01";
export const SAMPLE_MAX_DATE = "2027-12-31";
/** The locale the examples write dates in. */
export const SAMPLE_LOCALE = "en-GB";
