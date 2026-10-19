// The PDF viewer's body (the viewer, its native module and the document
// picker) is loaded lazily the first time the screen opens (§19.5): the route
// draws its skeleton until then. The body is the real one, held by a gate so the
// skeleton can be seen (test/module-gate.tsx).
import { screen } from "expo-router/testing-library";

import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { testAccessToken } from "../../../../../test/jwt";
import { createModuleGate } from "../../../../../test/module-gate";
import PdfViewerScreen from "../../../../app/(app)/settings/pdf-viewer";
import { PDF_VIEWER_COPY } from "../../../../features/pdf-viewer/labels";
import type * as PdfViewerScreenBodyModule from "../../../../features/pdf-viewer/pdf-viewer-screen-body";
import { ROUTES } from "../../../../runtime/routes";

const mockGate = createModuleGate();

jest.mock("../../../../features/pdf-viewer/pdf-viewer-screen-body", () => {
	const actual = jest.requireActual<typeof PdfViewerScreenBodyModule>("../../../../features/pdf-viewer/pdf-viewer-screen-body");
	return mockGate.evaluated({ ...actual, PdfViewerScreenBody: mockGate.gated(actual.PdfViewerScreenBody) });
});

describe("PDF viewer screen — loading its body", () => {
	it("evaluates the body only when the screen opens, drawing the skeleton until it is ready, then the screen", async () => {
		expect(mockGate.evaluations()).toBe(0);
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });

		await renderInApp(runtime, { "settings/pdf-viewer": PdfViewerScreen }, ROUTES.pdfViewer);
		expect(mockGate.evaluations()).toBe(1);
		expect(screen.getByTestId("pdf-viewer-skeleton")).toBeOnTheScreen();
		expect(screen.getByLabelText(PDF_VIEWER_COPY.loading)).toBeOnTheScreen();
		expect(screen.queryByTestId("pdf-viewer-choose")).toBeNull();

		await mockGate.open();
		expect(screen.getByTestId("pdf-viewer-choose")).toBeOnTheScreen();
		expect(screen.queryByTestId("pdf-viewer-skeleton")).toBeNull();
	});
});
