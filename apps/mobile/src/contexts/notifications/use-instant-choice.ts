// A toggle that answers the tap itself (the notification settings' checkboxes and switches): the new
// value shows inside the press, re-rendering only that one control, before the save is even queued.
// It holds only until the setting it came from is replaced (the instant save writes a new one, then the
// server's answer, or the server's state again after a failure), so a failed save still shows the truth.

import * as React from "react";

interface Choice {
	/** The setting object the person changed: the choice holds until it is replaced. */
	readonly source: object;
	readonly value: boolean;
}

export interface InstantChoice {
	/** What the control shows: the person's choice while it is pending, the setting otherwise. */
	readonly shown: boolean;
	/** Records the choice (shown at once), then hands it on to `save`. */
	readonly choose: (value: boolean) => void;
}

/** `source` is the setting's own object (kept by identity across unchanged updates); `stored` its value. */
export function useInstantChoice(source: object, stored: boolean, save: (value: boolean) => void): InstantChoice {
	const [choice, setChoice] = React.useState<Choice | null>(null);
	const choose = React.useCallback(
		(value: boolean): void => {
			setChoice({ source, value });
			save(value);
		},
		[save, source],
	);
	return { shown: choice?.source === source ? choice.value : stored, choose };
}
