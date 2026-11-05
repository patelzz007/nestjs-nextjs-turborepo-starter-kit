// Saving notification settings with an instant answer (the checkboxes, switches and digest): the
// change shows the moment it is tapped, written into the cached preferences, and the save runs
// behind it. While several saves are in flight, an earlier answer would put back a later tap,
// so only the last save to finish takes the server's answer; a failed one puts the server's
// state back (a refetch) and says so.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
import type { Envelope, NotificationPreferencesResponse } from "@workspace/shared";
import * as React from "react";

import { useToast } from "../../features/toast/facade";
import { NOTIFICATION_SETTINGS_COPY } from "./labels";

/** The preferences query the settings screen reads (`useQuery({})`). */
export const PREFERENCES_QUERY_KEY = apiRouter.notifications.preferences.queryKey({});

/** A save's options for `useMutation`. */
export interface PreferenceSaveOptions<TInput, TResponse> {
	readonly onMutate: (input: TInput) => Promise<void>;
	readonly onSuccess: (response: TResponse) => void;
	readonly onError: () => void;
}

export interface PreferenceSaves {
	/**
	 * The options for one kind of save: `apply` shows the change at once; `answerOf` reads the preferences
	 * from the server's answer (`null` when it sends none, and the preferences are read again instead).
	 */
	readonly optionsFor: <TInput, TResponse>(
		apply: (current: NotificationPreferencesResponse, input: TInput) => NotificationPreferencesResponse,
		answerOf: (response: TResponse) => NotificationPreferencesResponse | null,
	) => PreferenceSaveOptions<TInput, TResponse>;
}

/** One per settings screen: every card's saves share it, so their answers never overwrite each other's taps. */
export function usePreferenceSaves(): PreferenceSaves {
	const queryClient = useQueryClient();
	const toast = useToast();
	const inFlight = React.useRef(0);
	return React.useMemo(
		(): PreferenceSaves => ({
			optionsFor: <TInput, TResponse>(
				apply: (current: NotificationPreferencesResponse, input: TInput) => NotificationPreferencesResponse,
				answerOf: (response: TResponse) => NotificationPreferencesResponse | null,
			): PreferenceSaveOptions<TInput, TResponse> => {
				const settle = (): boolean => {
					inFlight.current -= 1;
					return inFlight.current === 0;
				};
				return {
					onMutate: (input: TInput): Promise<void> => {
						inFlight.current += 1;
						// A read already on its way would land on top of the tap: drop it. Its cancelling starts
						// now; nothing waits for it, so the change is written in this same step.
						void queryClient.cancelQueries({ queryKey: PREFERENCES_QUERY_KEY });
						queryClient.setQueryData<Envelope<NotificationPreferencesResponse>>(PREFERENCES_QUERY_KEY, (current) =>
							current === undefined ? current : { ...current, data: apply(current.data, input) },
						);
						return Promise.resolve();
					},
					onSuccess: (response: TResponse): void => {
						if (!settle()) {
							return;
						}
						const answer = answerOf(response);
						if (answer === null) {
							void queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
							return;
						}
						queryClient.setQueryData<Envelope<NotificationPreferencesResponse>>(PREFERENCES_QUERY_KEY, (current) =>
							current === undefined ? current : { ...current, data: answer },
						);
					},
					onError: (): void => {
						settle();
						void queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
						toast.error(NOTIFICATION_SETTINGS_COPY.saveFailed);
					},
				};
			},
		}),
		[queryClient, toast],
	);
}
