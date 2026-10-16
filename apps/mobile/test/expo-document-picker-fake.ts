// expo-document-picker under Jest (jest.setup.ts mocks "expo-document-picker"
// with this module): the file picker is the OS's. A test says what the person
// picks next (`pickNext`); otherwise the picker is closed without a choice.
// Every opening is recorded (`openings`). Reset before every test.

import type { DocumentPickerAsset, DocumentPickerOptions, DocumentPickerResult } from "expo-document-picker";

const CANCELED: DocumentPickerResult = { canceled: true, assets: null };

let next: DocumentPickerResult = CANCELED;
let failure: Error | null = null;
const opened: (DocumentPickerOptions | undefined)[] = [];

export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult> {
	opened.push(options);
	if (failure !== null) {
		const error = failure;
		failure = null;
		return Promise.reject(error);
	}
	const result = next;
	next = CANCELED;
	return Promise.resolve(result);
}

/** The person picks `asset` the next time the picker opens. */
export function pickNext(asset: DocumentPickerAsset): void {
	next = { canceled: false, assets: [asset] };
}

/** The next opening fails (the OS could not show the picker). */
export function failNext(error: Error): void {
	failure = error;
}

/** The options of every opening since the last reset. */
export function openings(): readonly (DocumentPickerOptions | undefined)[] {
	return [...opened];
}

export function reset(): void {
	next = CANCELED;
	failure = null;
	opened.length = 0;
}
