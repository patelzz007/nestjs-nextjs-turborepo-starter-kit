// One open PDF inside the screen: a row with the document's name and a close
// button, then the kit's PdfViewer filling the rest. It sits in the app
// shell's screen frame (ADR 046) — the shell's page header owns the top of
// the screen, status bar included — on a screen that does not scroll
// (`Screen scrollable={false}`), so the page column is the only vertical
// scroll. Controlled: the caller owns `source` and hears the close — from the
// close button, or Android's back button while the document is open (it
// returns to the choice instead of leaving the screen).
// Pages are drawn by this device's engine — the app's native module (ADR 056)
// — or, in Expo Go, the document is offered to another app.

import { IconButton } from "@workspace/ui-native/components/icon-button";
import { PdfViewer } from "@workspace/ui-native/components/pdf-viewer";
import { Subheading } from "@workspace/ui-native/components/text";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { BackHandler, View } from "react-native";

import { useToast } from "../toast/facade";
import { PDF_VIEWER_COPY } from "./labels";
import { deviceNativePdfEngine, type PdfEngine } from "./pdf-engine";
import type { PdfSource } from "./pdf-source";
import { usePdfDocument } from "./use-pdf-document";

export interface PdfDocumentViewerProps {
	readonly source: PdfSource;
	readonly onClose: () => void;
	/** Which engine draws the pages; by default this device's (none in Expo Go). */
	readonly engine?: PdfEngine | null | undefined;
}

export function PdfDocumentViewer({ source, onClose, engine }: PdfDocumentViewerProps): React.JSX.Element {
	// Whether the native module is present does not change while the app runs: decided once.
	const [activeEngine] = React.useState((): PdfEngine | null => (engine === undefined ? deviceNativePdfEngine() : engine));
	const document = usePdfDocument(source, activeEngine);
	const toast = useToast();

	// Mounted only while a document is open: back closes it, and the subscription ends with it.
	React.useEffect((): (() => void) => {
		const subscription = BackHandler.addEventListener("hardwareBackPress", (): boolean => {
			onClose();
			return true;
		});
		return (): void => {
			subscription.remove();
		};
	}, [onClose]);

	const { openExternally } = document;
	const handleOpenExternally = React.useMemo(
		(): (() => void) | undefined =>
			openExternally === null
				? undefined
				: (): void => {
						openExternally().catch((): void => {
							toast.error(PDF_VIEWER_COPY.openExternallyFailed);
						});
					},
		[openExternally, toast],
	);

	return (
		<View className="flex-1 gap-3" testID="pdf-document-viewer">
			<View className="flex-row items-center gap-2">
				<View className="min-w-0 flex-1">
					<Subheading numberOfLines={2}>{source.fileName}</Subheading>
				</View>
				<IconButton icon={XIcon} label={PDF_VIEWER_COPY.close} variant="ghost" onPress={onClose} testID="pdf-document-viewer-close" />
			</View>
			<PdfViewer state={document.state} renderPage={document.renderPage} onRetry={document.retry} onOpenExternally={handleOpenExternally} testID="pdf-document" />
		</View>
	);
}
