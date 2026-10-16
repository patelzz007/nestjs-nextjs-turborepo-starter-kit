import { buildTextPdf, PDF_MEDIA_TYPE } from "@workspace/shared";
import { DEFAULT_PDF_VIEWER_LABELS } from "@workspace/ui-native/components/pdf-viewer";
import { Slot } from "expo-router";
import { act } from "@testing-library/react-native";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { BackHandler, type HardwareBackPressEvent, type NativeEventSubscription } from "react-native";
import * as React from "react";

import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { failNext, pickNext } from "../../../../../test/expo-document-picker-fake";
import { putFile, serveDownload } from "../../../../../test/expo-file-system-fake";
import { shares } from "../../../../../test/expo-sharing-fake";
import { testAccessToken } from "../../../../../test/jwt";
import PdfViewerScreen from "../../../../app/(app)/settings/pdf-viewer";
import { PDF_VIEWER_COPY } from "../../../../features/pdf-viewer/labels";
import { SAMPLE_PDF_NAME } from "../../../../features/pdf-viewer/pdf-files";
import { PageHeaderClearanceProvider } from "../../../../lib/page-header-clearance";
import { ROUTES } from "../../../../runtime/routes";

const PDF_BYTES = new TextEncoder().encode(buildTextPdf([{ title: "Statement", lines: ["Balance: 120.00"] }]));
const PICKED_URI = "file:///cache/DocumentPicker/statement.pdf";
const SIGNED_URL = "https://storage.example.com/kyb/statement.pdf";

/** How far the app shell's page header (status bar included) reaches down, as the shell reports it. */
const PAGE_HEADER_CLEARANCE = 104;

/** The app shell's part a screen relies on: the page header laid over the top (ADR 046). */
function UnderPageHeader(): React.JSX.Element {
	return (
		<PageHeaderClearanceProvider value={PAGE_HEADER_CLEARANCE}>
			<Slot />
		</PageHeaderClearanceProvider>
	);
}

async function renderViewer(url: string = ROUTES.pdfViewer): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, { "settings/_layout": UnderPageHeader, "settings/pdf-viewer": PdfViewerScreen }, url);
}

/** In Jest — as in Expo Go — the app's native PDF module is absent: documents are offered to another app. */
async function expectOfferedToAnotherApp(): Promise<void> {
	await waitFor((): void => {
		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.externalTitle)).toBeOnTheScreen();
	});
}

describe("PDF viewer screen", () => {
	it("opens nothing until a PDF is chosen, and nothing when the person backs out", async () => {
		await renderViewer();

		expect(screen.getByText(PDF_VIEWER_COPY.chooseTitle)).toBeOnTheScreen();
		expect(screen.queryByTestId("pdf-document-viewer")).toBeNull();
		await fireEvent.press(screen.getByTestId("pdf-viewer-choose"));
		expect(screen.queryByTestId("pdf-document-viewer")).toBeNull();
	});

	it("opens the picked PDF full-screen under its name, and hands it to another app", async () => {
		putFile(PICKED_URI, PDF_BYTES);
		pickNext({ uri: PICKED_URI, name: "statement.pdf", mimeType: PDF_MEDIA_TYPE, size: PDF_BYTES.length, lastModified: 0 });
		await renderViewer();

		await fireEvent.press(screen.getByTestId("pdf-viewer-choose"));
		await expectOfferedToAnotherApp();
		expect(screen.getByRole("header", { name: "statement.pdf" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally }));
		const [shared] = shares();
		expect(shared?.url).toBe(PICKED_URI);
		expect(shared?.options?.mimeType).toBe(PDF_MEDIA_TYPE);
	});

	it("shows the open document below the app shell's page header, leaving the top of the screen to it", async () => {
		await renderViewer();
		await fireEvent.press(screen.getByTestId("pdf-viewer-sample"));
		await expectOfferedToAnotherApp();

		const content = screen.getByTestId("pdf-viewer-screen-content");
		expect(content).toHaveStyle({ paddingTop: PAGE_HEADER_CLEARANCE });
		expect(within(content).getByRole("button", { name: PDF_VIEWER_COPY.close })).toBeOnTheScreen();
		expect(within(content).getByRole("header", { name: SAMPLE_PDF_NAME })).toBeOnTheScreen();
		// The page column scrolls itself: the screen around it does not.
		expect(content).not.toHaveProp("contentContainerStyle");
	});

	it("closes the document", async () => {
		await renderViewer();
		await fireEvent.press(screen.getByTestId("pdf-viewer-sample"));
		await expectOfferedToAnotherApp();

		await fireEvent.press(screen.getByRole("button", { name: PDF_VIEWER_COPY.close }));
		expect(screen.queryByTestId("pdf-document-viewer")).toBeNull();
		expect(screen.getByTestId("pdf-viewer-choose")).toBeOnTheScreen();
	});

	it("closes an open document on Android's back button, and stops listening once it is closed", async () => {
		/** Every back-button subscription, in order: the router's own, then the document's. */
		const subscriptions: { readonly handler: (event: HardwareBackPressEvent) => boolean | null | undefined; readonly remove: jest.Mock<undefined, []> }[] = [];
		jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler): NativeEventSubscription => {
			const remove = jest.fn<undefined, []>();
			subscriptions.push({ handler, remove });
			return { remove };
		});
		await renderViewer();
		const beforeOpening = subscriptions.length;

		await fireEvent.press(screen.getByTestId("pdf-viewer-sample"));
		await expectOfferedToAnotherApp();
		const documentSubscriptions = subscriptions.slice(beforeOpening);
		expect(documentSubscriptions).toHaveLength(1);
		const [documentSubscription] = documentSubscriptions;

		const handled: { value: boolean | null | undefined } = { value: false };
		await act((): void => {
			handled.value = documentSubscription?.handler({ type: "hardwareBackPress", timeStamp: 0 });
		});
		expect(handled.value).toBe(true);
		expect(screen.queryByTestId("pdf-document-viewer")).toBeNull();
		expect(screen.getByTestId("pdf-viewer-choose")).toBeOnTheScreen();
		expect(documentSubscription?.remove).toHaveBeenCalledTimes(1);
	});

	it("opens the app's sample document", async () => {
		await renderViewer();

		await fireEvent.press(screen.getByTestId("pdf-viewer-sample"));
		await expectOfferedToAnotherApp();
		expect(screen.getByRole("header", { name: SAMPLE_PDF_NAME })).toBeOnTheScreen();
	});

	it("says so when the picker cannot open", async () => {
		failNext(new Error("picker unavailable"));
		await renderViewer();

		await fireEvent.press(screen.getByTestId("pdf-viewer-choose"));
		expect(await screen.findByText(PDF_VIEWER_COPY.pickFailed)).toBeOnTheScreen();
	});

	it("downloads and opens the document another screen sends", async () => {
		serveDownload(SIGNED_URL, PDF_BYTES);
		await renderViewer(`${ROUTES.pdfViewer}?url=${encodeURIComponent(SIGNED_URL)}&name=${encodeURIComponent("Bank statement")}`);

		await expectOfferedToAnotherApp();
		expect(screen.getByRole("header", { name: "Bank statement" })).toBeOnTheScreen();
	});

	it("refuses a link that names no web document", async () => {
		await renderViewer(`${ROUTES.pdfViewer}?url=${encodeURIComponent("file:///etc/hosts")}`);

		expect(screen.getByText(PDF_VIEWER_COPY.invalidLink)).toBeOnTheScreen();
		expect(screen.queryByTestId("pdf-document-viewer")).toBeNull();
	});
});
