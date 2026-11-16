import { fireEvent, screen } from "@testing-library/react-native";
import * as React from "react";

import { failNext, pickNext as pickDocumentNext } from "../../../../test/expo-document-picker-fake";
import { pickNext as pickImageNext } from "../../../../test/expo-image-picker-fake";
import { fakeDeviceBoundaries, renderShowcaseExample, settle } from "../../../../test/showcase-example";
import { SHOWCASE_FEATURE_SETS } from "../generated/feature-sets";
import type { ShowcaseComponentModule } from "../showcase-feature";

const REPORT_BYTES = 2_400_000;
const PHOTO_WIDTH = 1600;
const PHOTO_HEIGHT = 900;

/** The file and the photo the person picks next, whichever picker an example opens. */
function queuePicks(): void {
	pickDocumentNext({ uri: "file:///report.pdf", name: "report.pdf", mimeType: "application/pdf", size: REPORT_BYTES, lastModified: 0 });
	pickImageNext({ uri: "file:///cover.jpg", fileName: "cover.jpg", mimeType: "image/jpeg", fileSize: REPORT_BYTES, width: PHOTO_WIDTH, height: PHOTO_HEIGHT, type: "image" });
}

/** How many settles a sample upload takes to finish: it moves a fifth at a time. */
const UPLOAD_SETTLES = 3;

function loadFileUpload(): Promise<ShowcaseComponentModule> {
	const load = SHOWCASE_FEATURE_SETS.get("file-upload");
	if (load === undefined) {
		throw new Error("The showcase has no file-upload examples");
	}
	return load();
}

beforeEach((): void => {
	jest.useFakeTimers();
	fakeDeviceBoundaries();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("the file upload examples, used", () => {
	it("pick a file or a photo, show it uploading, then uploaded; and remove it again", async () => {
		const { features } = await loadFileUpload();
		for (const feature of features) {
			await renderShowcaseExample(feature.render(), `upload-${feature.anchor}`);
			for (const button of screen.queryAllByRole("button")) {
				queuePicks();
				await fireEvent.press(button);
				for (let tick = 0; tick < UPLOAD_SETTLES; tick += 1) {
					await settle();
				}
			}
			expect(screen.getByTestId(`upload-${feature.anchor}`)).toBeOnTheScreen();
			for (const remove of screen.queryAllByRole("button", { name: /^(Remove|Clear)/u })) {
				await fireEvent.press(remove);
			}
		}
	});

	it("leave the list as it was when the picker cannot open", async () => {
		const { features } = await loadFileUpload();
		const [first] = features;
		if (first === undefined) {
			throw new Error("No file-upload example");
		}
		await renderShowcaseExample(first.render());
		failNext(new Error("No picker"));
		const [choose] = screen.getAllByRole("button");
		if (choose !== undefined) {
			await fireEvent.press(choose);
		}
		await settle();
		expect(screen.getByTestId("example")).toBeOnTheScreen();
	});
});
