import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { Envelope, NotificationPreferencesResponse, NotificationSchedule } from "@workspace/shared";
import { epochMs, withSchedule } from "@workspace/shared";
import * as React from "react";

import { ToastStoreProvider } from "../../../features/toast/facade";
import { createToastStore, type ToastStore } from "../../../features/toast/store";
import { NOTIFICATION_SETTINGS_COPY } from "../labels";
import { PREFERENCES_QUERY_KEY, usePreferenceSaves, type PreferenceSaveOptions } from "../use-preference-saves";

const PREFERENCES: NotificationPreferencesResponse = {
	tenantId: null,
	categories: [],
	platformMarketingConsent: false,
	schedule: { quietHoursEnabled: false, quietStartMinute: 1320, quietEndMinute: 420, timeZone: "Asia/Kuala_Lumpur", digestFrequency: "OFF" },
	tenants: [],
};
/** What every answer carries beside its data. */
const META = { correlationId: "corr-test", timestamp: epochMs(Date.UTC(2026, 10, 3)) };

const QUIET_ON: NotificationSchedule = { ...PREFERENCES.schedule, quietHoursEnabled: true };
const DAILY: NotificationSchedule = { ...PREFERENCES.schedule, digestFrequency: "DAILY" };

function envelope(data: NotificationPreferencesResponse): Envelope<NotificationPreferencesResponse> {
	return { success: true, data, meta: META };
}

interface Harness {
	readonly client: QueryClient;
	readonly toasts: ToastStore;
	readonly options: PreferenceSaveOptions<NotificationSchedule, Envelope<NotificationPreferencesResponse>>;
}

async function harness(): Promise<Harness> {
	const client = new QueryClient();
	client.setQueryData(PREFERENCES_QUERY_KEY, envelope(PREFERENCES));
	const toasts = createToastStore();
	function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<QueryClientProvider client={client}>
				<ToastStoreProvider store={toasts}>{children}</ToastStoreProvider>
			</QueryClientProvider>
		);
	}
	const { result } = await renderHook(() => usePreferenceSaves(), { wrapper: Wrapper });
	const options = result.current.optionsFor(withSchedule, (response: Envelope<NotificationPreferencesResponse>) => response.data);
	return { client, toasts, options };
}

function cached(client: QueryClient): NotificationPreferencesResponse | undefined {
	return client.getQueryData<Envelope<NotificationPreferencesResponse>>(PREFERENCES_QUERY_KEY)?.data;
}

describe("usePreferenceSaves", () => {
	it("shows a change the moment it is made, then takes the server's answer", async () => {
		const { client, options } = await harness();
		await act(async (): Promise<void> => {
			await options.onMutate(QUIET_ON);
		});
		expect(cached(client)?.schedule.quietHoursEnabled).toBe(true);

		const answer = { ...PREFERENCES, schedule: QUIET_ON, platformMarketingConsent: true };
		await act((): void => {
			options.onSuccess(envelope(answer));
		});
		expect(cached(client)).toEqual(answer);
	});

	it("never lets an earlier answer put back a later tap", async () => {
		const { client, options } = await harness();
		await act(async (): Promise<void> => {
			await options.onMutate(QUIET_ON);
			await options.onMutate(DAILY);
		});
		// The first save answers while the second is still on its way: the second tap stays shown.
		await act((): void => {
			options.onSuccess(envelope(withSchedule(PREFERENCES, QUIET_ON)));
		});
		expect(cached(client)?.schedule.digestFrequency).toBe("DAILY");
		// The last one to finish takes the server's answer.
		await act((): void => {
			options.onSuccess(envelope(withSchedule(PREFERENCES, DAILY)));
		});
		expect(cached(client)?.schedule).toEqual(DAILY);
	});

	it("says a save failed and reads the preferences again", async () => {
		const { client, toasts, options } = await harness();
		const invalidate = jest.spyOn(client, "invalidateQueries");
		await act(async (): Promise<void> => {
			await options.onMutate(QUIET_ON);
		});
		await act((): void => {
			options.onError();
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: PREFERENCES_QUERY_KEY });
		expect(toasts.getState().current).toMatchObject({ tone: "error", message: NOTIFICATION_SETTINGS_COPY.saveFailed });
	});
});
