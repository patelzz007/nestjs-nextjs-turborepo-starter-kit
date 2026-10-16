// expo-sharing under Jest (jest.setup.ts mocks "expo-sharing" with this
// module): the share sheet is the OS's. Every share is recorded (`shares`);
// a test can make the next one fail (`failNextShare`). Reset before every test.

import type { SharingOptions } from "expo-sharing";

/** One share a test can inspect. */
export interface RecordedShare {
	readonly url: string;
	readonly options: SharingOptions | undefined;
}

const recorded: RecordedShare[] = [];
let failure: Error | null = null;

export function shareAsync(url: string, options?: SharingOptions): Promise<void> {
	recorded.push({ url, options });
	if (failure !== null) {
		const error = failure;
		failure = null;
		return Promise.reject(error);
	}
	return Promise.resolve();
}

export function isAvailableAsync(): Promise<boolean> {
	return Promise.resolve(true);
}

/** The next share fails (no app could take the file). */
export function failNextShare(error: Error): void {
	failure = error;
}

/** Every share since the last reset, oldest first. */
export function shares(): readonly RecordedShare[] {
	return [...recorded];
}

export function reset(): void {
	recorded.length = 0;
	failure = null;
}
