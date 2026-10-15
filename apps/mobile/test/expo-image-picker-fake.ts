// expo-image-picker under Jest (jest.setup.ts mocks "expo-image-picker" with
// this module): the photo library is the OS's. A test says what the writer
// picks next (`pickNext`); otherwise the picker is closed without a choice.
// Every opening is recorded (`openings`). Reset before every test.

import type { ImagePickerAsset, ImagePickerOptions, ImagePickerResult } from "expo-image-picker";

const CANCELED: ImagePickerResult = { canceled: true, assets: null };

let next: ImagePickerResult = CANCELED;
const opened: (ImagePickerOptions | undefined)[] = [];

export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult> {
	opened.push(options);
	const result = next;
	next = CANCELED;
	return Promise.resolve(result);
}

/** The writer picks `asset` the next time the library opens. */
export function pickNext(asset: ImagePickerAsset): void {
	next = { canceled: false, assets: [asset] };
}

/** The options of every opening since the last reset. */
export function openings(): readonly (ImagePickerOptions | undefined)[] {
	return [...opened];
}

export function reset(): void {
	next = CANCELED;
	opened.length = 0;
}
