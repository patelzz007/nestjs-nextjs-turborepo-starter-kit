import { vi } from "vitest";

/**
 * jsdom never loads images, so an avatar (which shows its picture only once the
 * picture has loaded) would never render it in a test. This stands in for
 * `window.Image` as an image that is already loaded — the picture shows at once.
 * Returns the restore function; call it in `afterEach`.
 */
export function stubLoadedImages(): () => void {
	class LoadedImage {
		public readonly complete = true;
		public readonly naturalWidth = 1;
		public onload: (() => void) | null = null;
		public onerror: (() => void) | null = null;
		public referrerPolicy = "";
		public crossOrigin: string | null = null;
		public sizes = "";
		public srcset = "";
		public src = "";
	}
	vi.stubGlobal("Image", LoadedImage);
	return (): void => {
		vi.unstubAllGlobals();
	};
}
