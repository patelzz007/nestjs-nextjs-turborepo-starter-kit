// Opens the document a PdfSource names and reports it as the kit's
// PdfViewer state: download it (a remote source), check it (`checkPdfFile`),
// then let the engine read its pages. Without an engine (Expo Go) the checked
// file is offered to another app instead ("external"). A newer source — or a
// retry — supersedes a load still in flight.

import type { PdfOpenFailure } from "@workspace/shared";
import type { PdfPageRenderer, PdfViewerState } from "@workspace/ui-native/components/pdf-viewer";
import * as React from "react";

import type { PdfEngine, PdfOpenResult } from "./pdf-engine";
import { checkLocalPdf, downloadPdf, sharePdf } from "./pdf-files";
import type { PdfSource } from "./pdf-source";

export interface PdfDocument {
	readonly state: PdfViewerState;
	readonly renderPage: PdfPageRenderer;
	readonly retry: () => void;
	/** Hands the file to another app; `null` until there is a file on the phone to hand over. Rejects when no app takes it. */
	readonly openExternally: (() => Promise<void>) | null;
}

/** Where a load got to: the viewer's state, and the file on the phone once there is one. */
interface LoadedDocument {
	readonly state: PdfViewerState;
	readonly fileUri: string | null;
}

const LOADING: LoadedDocument = { state: { status: "loading" }, fileUri: null };

/** The document could not be fetched or read: nothing on the phone to show or share. */
function unavailable(failure: PdfOpenFailure): LoadedDocument {
	return { state: { status: "failed", failure }, fileUri: null };
}

/** The file on the phone `source` names (downloading it first when it is remote). */
function localFileOf(source: PdfSource): Promise<string> {
	switch (source.kind) {
		case "remote":
			return downloadPdf(source.url, source.fileName);
		case "picked":
			return Promise.resolve(source.uri);
	}
}

/** Every step of opening `source`; never rejects — a failure is a state. */
async function loadDocument(source: PdfSource, engine: PdfEngine | null): Promise<LoadedDocument> {
	let fileUri: string;
	try {
		fileUri = await localFileOf(source);
	} catch {
		return unavailable("unavailable");
	}
	let check: ReturnType<typeof checkLocalPdf>;
	try {
		check = checkLocalPdf(fileUri);
	} catch {
		return unavailable("unavailable");
	}
	if (!check.ok) {
		return { state: { status: "failed", failure: check.failure }, fileUri };
	}
	if (engine === null) {
		return { state: { status: "external" }, fileUri };
	}
	const opened: PdfOpenResult = await engine.open(fileUri);
	return { state: opened.ok ? { status: "ready", pages: opened.pages } : { status: "failed", failure: opened.failure }, fileUri };
}

/** The rejection `renderPage` gives before a document is open (the viewer never asks then). */
class PdfNotOpenError extends Error {
	public constructor() {
		super("No PDF is open");
		this.name = "PdfNotOpenError";
	}
}

/** One load: what is opened, with what, and which try it is. A new request object is a new load. */
interface PdfLoadRequest {
	readonly source: PdfSource;
	readonly engine: PdfEngine | null;
	readonly attempt: number;
}

/** The outcome of one request; the viewer shows it only while that request is the current one. */
interface SettledLoad {
	readonly request: PdfLoadRequest;
	readonly result: LoadedDocument;
}

/** The document `source` names, opened with `engine` (`null`: no in-app engine on this device). */
export function usePdfDocument(source: PdfSource | null, engine: PdfEngine | null): PdfDocument {
	const [attempt, setAttempt] = React.useState(0);
	const [settled, setSettled] = React.useState<SettledLoad | null>(null);
	const request = React.useMemo((): PdfLoadRequest | null => (source === null ? null : { source, engine, attempt }), [source, engine, attempt]);

	React.useEffect((): (() => void) | undefined => {
		if (request === null) {
			return undefined;
		}
		const current = { active: true };
		void loadDocument(request.source, request.engine).then((result: LoadedDocument): void => {
			if (current.active) {
				setSettled({ request, result });
			}
		});
		return (): void => {
			current.active = false;
		};
	}, [request]);
	// Until the current request settles (a new source, a retry), the document is loading.
	const loaded = settled !== null && settled.request === request ? settled.result : LOADING;

	const retry = React.useCallback((): void => {
		setAttempt((count: number): number => count + 1);
	}, []);

	const { fileUri } = loaded;
	const renderPage = React.useCallback(
		(pageIndex: number, widthPx: number): Promise<string> =>
			engine === null || fileUri === null ? Promise.reject(new PdfNotOpenError()) : engine.renderPage(fileUri, pageIndex, widthPx),
		[engine, fileUri],
	);
	const fileName = source?.fileName ?? null;
	const openExternally = React.useMemo(
		(): (() => Promise<void>) | null => (fileUri === null || fileName === null ? null : (): Promise<void> => sharePdf(fileUri, fileName)),
		[fileName, fileUri],
	);

	return { state: loaded.state, renderPage, retry, openExternally };
}
