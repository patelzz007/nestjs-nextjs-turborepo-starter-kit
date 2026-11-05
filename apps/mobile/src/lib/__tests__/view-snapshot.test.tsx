import { render } from "@testing-library/react-native";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { snapshotView, type ViewShotNativeModule, type ViewShotOptions } from "../view-snapshot";

const OPTIONS: ViewShotOptions = { format: "jpg", quality: 0.9, result: "tmpfile", snapshotContentContainer: false, handleGLSurfaceViewOnAndroid: false };

function fakeModule(): ViewShotNativeModule & { readonly calls: [number, ViewShotOptions][] } {
	const calls: [number, ViewShotOptions][] = [];
	return {
		calls,
		getConstants: (): object => ({}),
		captureRef: (viewTag: number, options: ViewShotOptions): Promise<string> => {
			calls.push([viewTag, options]);
			return Promise.resolve("file:///cache/shot.jpg");
		},
		releaseCapture: jest.fn(),
	};
}

describe("view snapshot", () => {
	it("photographs a view on screen by its native tag, with the options given", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<View ref={ref} collapsable={false} />);
		const module = fakeModule();
		const view = ref.current;
		if (view === null) {
			throw new Error("The view did not mount");
		}
		await expect(snapshotView(module, view, OPTIONS)).resolves.toBe("file:///cache/shot.jpg");
		expect(module.calls.map(([, options]) => options)).toEqual([OPTIONS]);
	});
});
