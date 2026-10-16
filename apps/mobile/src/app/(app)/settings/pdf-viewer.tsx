// ============================================
// PDF viewer — read a PDF on the phone (features/pdf-viewer, ADR 056)
// ============================================
// Pick a PDF from Files / Downloads / a cloud drive, or arrive with
// `?url=&name=` from another screen (`pdfViewerHref`): the document then fills
// the screen under the app shell's page header, on a frame that does not
// scroll (the page column scrolls itself); closing it returns to the choice. Pages are drawn by the phone's own PDF engine
// through the app's native module; in Expo Go the document is offered to
// another app instead.

import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { MutedText } from "@workspace/ui-native/components/text";
import { useLocalSearchParams } from "expo-router";
import FileUpIcon from "lucide-react-native/icons/file-up";
import * as React from "react";
import { z } from "zod";

import { Screen } from "../../../components/screen";
import { PDF_VIEWER_COPY } from "../../../features/pdf-viewer/labels";
import { PdfDocumentViewer } from "../../../features/pdf-viewer/pdf-document-viewer";
import { pickPdf, writeSamplePdf } from "../../../features/pdf-viewer/pdf-files";
import { pdfSourceOfRouteParams, type PdfSource } from "../../../features/pdf-viewer/pdf-source";
import { useToast } from "../../../features/toast/facade";

/** The route carries some `?url=` — whether or not it names a document the viewer may open. */
const LinkParamSchema = z.object({ url: z.string() });

export default function PdfViewerScreen(): React.JSX.Element {
	const params = useLocalSearchParams();
	// The route's document opens once, when the screen does; after that the person picks.
	const [source, setSource] = React.useState<PdfSource | null>((): PdfSource | null => pdfSourceOfRouteParams(params));
	const [isInvalidLink] = React.useState((): boolean => source === null && LinkParamSchema.safeParse(params).success);
	const [isPicking, setPicking] = React.useState(false);
	const toast = useToast();

	const choose = React.useCallback((): void => {
		setPicking(true);
		pickPdf()
			.then((picked: PdfSource | null): void => {
				if (picked !== null) {
					setSource(picked);
				}
			})
			.catch((): void => {
				toast.error(PDF_VIEWER_COPY.pickFailed);
			})
			.finally((): void => {
				setPicking(false);
			});
	}, [toast]);
	const openSample = React.useCallback((): void => {
		try {
			setSource(writeSamplePdf());
		} catch {
			toast.error(PDF_VIEWER_COPY.sampleFailed);
		}
	}, [toast]);
	const close = React.useCallback((): void => {
		setSource(null);
	}, []);

	if (source !== null) {
		return (
			<Screen scrollable={false} testID="pdf-viewer-screen">
				<PdfDocumentViewer source={source} onClose={close} />
			</Screen>
		);
	}
	return (
		<Screen description={PDF_VIEWER_COPY.description} testID="pdf-viewer-screen">
			{isInvalidLink ? <Alert tone="error" message={PDF_VIEWER_COPY.invalidLink} /> : null}
			<Card title={PDF_VIEWER_COPY.chooseTitle}>
				<MutedText>{PDF_VIEWER_COPY.chooseDescription}</MutedText>
				<Button label={PDF_VIEWER_COPY.choose} icon={FileUpIcon} onPress={choose} loading={isPicking} testID="pdf-viewer-choose" />
				<Button label={PDF_VIEWER_COPY.sample} variant="secondary" onPress={openSample} testID="pdf-viewer-sample" />
			</Card>
		</Screen>
	);
}
