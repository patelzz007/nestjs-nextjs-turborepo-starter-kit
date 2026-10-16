// The Components screen's media and content: Carousel, ImageCarousel,
// ImageResizer, CoverImage, CodeBlock, QrCode, Bubble, Message, Attachment and PdfViewer. Each example
// owns its demo state here (the kit components stay controlled); nothing is
// sent to the API, and no picture is fetched: the gallery works offline and its
// tests never reach the network. The pictures are the app's own bundled artwork
// (resolved by `Image.resolveAssetSource`); the other slides show the kit's
// placeholder state (`uri: null`), as a gallery does while photos process.

import * as Clipboard from "expo-clipboard";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import ImageIcon from "lucide-react-native/icons/image";
import type { ImageSize } from "@workspace/shared";
import * as React from "react";
import { Image, View } from "react-native";
import { z } from "zod";

import { Attachment } from "@workspace/ui-native/components/attachment";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Button } from "@workspace/ui-native/components/button";
import { Carousel } from "@workspace/ui-native/components/carousel";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { CoverImage } from "@workspace/ui-native/components/cover-image";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui-native/components/image-carousel";
import { ImageResizer } from "@workspace/ui-native/components/image-resizer";
import { Message } from "@workspace/ui-native/components/message";
import { PdfViewer, type PdfViewerState } from "@workspace/ui-native/components/pdf-viewer";
import { QrCode } from "@workspace/ui-native/components/qr-code";
import { Switch } from "@workspace/ui-native/components/switch";
import { BodyText, MutedText, Subheading } from "@workspace/ui-native/components/text";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import appIcon from "../../../../assets/app-icon.png";
import splashIcon from "../../../../assets/splash-icon.png";
import { DemoBlock } from "../demo-block";

const FIRST_SLIDE = 0;
/** Slides count from one for people. */
const POSITION_OFFSET = 1;

// ── Carousel ───────────────────────────────────────────────────────────────

interface Tip {
	readonly key: string;
	readonly title: string;
	readonly body: string;
}

const TIPS: readonly Tip[] = [
	{ key: "earn", title: "Earn on every visit", body: "Show your QR code at the counter and points land in your wallet." },
	{ key: "tiers", title: "Climb the tiers", body: "Gold members get a free drink every month and early access to offers." },
	{ key: "secure", title: "Secure by design", body: "Turn on two-factor sign-in from Profile to protect your rewards." },
];

// ── ImageCarousel and CoverImage ───────────────────────────────────────────

/**
 * What a resolved bundled asset must hold to be shown. `resolveAssetSource` is
 * typed as always returning a `uri`, but outside Metro (Jest's asset transform)
 * there is none — so the shape is checked, not assumed (rules/28).
 */
const ResolvedAssetSchema = z.object({ uri: z.string().min(1) });

/** A bundled picture's URI, or `null` (the placeholder) when the runtime resolves no source. */
function bundledImageUri(asset: number): string | null {
	const resolved = ResolvedAssetSchema.safeParse(Image.resolveAssetSource(asset));
	return resolved.success ? resolved.data.uri : null;
}

const APP_ICON_URI = bundledImageUri(appIcon);
const SPLASH_ICON_URI = bundledImageUri(splashIcon);

/** A reward's gallery: two loaded pictures, then one still processing (the placeholder holds its space). */
const REWARD_PHOTOS: readonly ImageCarouselImage[] = [
	{ id: "front", uri: APP_ICON_URI, alt: "The app icon, as a reward photo" },
	{ id: "detail", uri: SPLASH_ICON_URI, alt: "The launch artwork, as a second photo" },
	{ id: "store", uri: null, alt: "A photo that is still processing" },
];

// ── ImageResizer ───────────────────────────────────────────────────────────

/** The demo picture's starting size, in points (the square app icon). */
const RESIZER_START_SIZE: ImageSize = { width: 160, height: 160 };
/** Fits the narrowest phone's content column, with room for the handles either side. */
const RESIZER_MAX_WIDTH_PT = 240;
const SQUARE_RATIO = 1;

// ── CodeBlock ──────────────────────────────────────────────────────────────

const SIGN_IN_CODE = `const session = await auth.signIn({ email, password });
if (session.requiresTwoFactor) {
  router.push("/two-factor");
}`;

// ── QrCode ─────────────────────────────────────────────────────────────────

const REDEMPTION_URL = "https://rewards.example.com/redeem/RWD-4821-KLCC";

// ── PdfViewer ──────────────────────────────────────────────────────────────

/** The viewer's states a gallery can show without a document: live pages need the PDF viewer screen's engine. */
type PdfDemoState = "loading" | "failed" | "external";

const PDF_DEMO_OPTIONS: readonly ToggleGroupOption<PdfDemoState>[] = [
	{ value: "loading", label: "Loading" },
	{ value: "failed", label: "Failed" },
	{ value: "external", label: "Other app" },
];

const PDF_DEMO_STATES: Readonly<Record<PdfDemoState, PdfViewerState>> = {
	loading: { status: "loading" },
	failed: { status: "failed", failure: "password_protected" },
	external: { status: "external" },
};

/** The gallery has no document, so no page is ever asked for. */
function noPages(): Promise<string> {
	return Promise.reject(new Error("The gallery shows no pages"));
}

/** The gallery's buttons do nothing: no document is handed to another app. */
function doNothing(): void {
	// A demo action.
}

export function MediaDemos(): React.JSX.Element {
	return (
		<>
			<DemoBlock title="Carousel" description="Swipeable slides with page dots; the screen owns which slide shows.">
				<CarouselDemo />
			</DemoBlock>
			<DemoBlock title="ImageCarousel" description="A swipeable gallery of pictures in one aspect ratio, each described for screen readers.">
				<ImageCarouselDemo />
			</DemoBlock>
			<DemoBlock title="ImageResizer" description="A picture resized by dragging its corner and edge handles; screen readers step each handle.">
				<ImageResizerDemo />
			</DemoBlock>
			<DemoBlock title="CoverImage" description="A picture in a fixed ratio, with a placeholder when there is none or it fails to load.">
				<View className="flex-row gap-3">
					<CoverImage uri={APP_ICON_URI} alt="The app icon" ratio="square" className="flex-1" />
					<CoverImage uri={null} alt="Store front photo pending" ratio="portrait" variant="flush" className="flex-1" />
				</View>
			</DemoBlock>
			<DemoBlock title="CodeBlock" description="Monospaced code that scrolls sideways; the screen copies it to the clipboard.">
				<CodeBlockDemo />
			</DemoBlock>
			<DemoBlock title="QrCode" description="A scannable code, dark on light in every theme, named by the screen.">
				<View className="flex-row items-end gap-3">
					<QrCode value={REDEMPTION_URL} label="Reward redemption QR code" />
					<QrCode value={REDEMPTION_URL} label="Small reward redemption QR code" size="sm" />
				</View>
			</DemoBlock>
			<DemoBlock title="Bubble" description="One chat message's surface: primary when sent, muted when received.">
				<Bubble text="Is the 3 pm pickup still on?" />
				<Bubble variant="sent" text="Yes, see you at the counter!" />
			</DemoBlock>
			<DemoBlock title="Message" description="A chat row: avatar, author, bubbles and a timestamp the screen formats.">
				<Message author="Aisyah Rahman" timestamp="09:41" avatar={<Avatar name="Aisyah Rahman" imageUrl={null} size="md" />}>
					<Bubble text="Morning! Did the receipts upload?" />
					<Bubble text="I need them for the monthly report." />
				</Message>
				<Message variant="sent" timestamp="09:43">
					<Bubble variant="sent" text="Uploading now, here's the first one.">
						<Attachment name="receipts-september.xlsx" description="184 KB · Spreadsheet" icon={FileSpreadsheetIcon} variant="muted" size="sm" />
					</Bubble>
				</Message>
			</DemoBlock>
			<DemoBlock title="Attachment" description="A file chip with its detail; open it, remove it, or follow its upload.">
				<AttachmentDemo />
			</DemoBlock>
			<DemoBlock title="PdfViewer" description="A PDF page under page with page and zoom controls; the app's engine draws the pages.">
				<PdfViewerDemo />
			</DemoBlock>
		</>
	);
}

function PdfViewerDemo(): React.JSX.Element {
	const [state, setState] = React.useState<PdfDemoState>("loading");
	const choose = React.useCallback((pressed: PdfDemoState | null): void => {
		if (pressed !== null) {
			setState(pressed);
		}
	}, []);
	return (
		<>
			<ToggleGroup type="single" label="Viewer state" options={PDF_DEMO_OPTIONS} value={state} onChange={choose} size="sm" testID="pdf-demo-states" />
			<PdfViewer state={PDF_DEMO_STATES[state]} renderPage={noPages} onRetry={doNothing} onOpenExternally={doNothing} className="h-96" />
			<MutedText>Open Settings → PDF viewer to read a real document.</MutedText>
		</>
	);
}

function CarouselDemo(): React.JSX.Element {
	const [index, setIndex] = React.useState(FIRST_SLIDE);
	return (
		<>
			<Carousel index={index} onChange={setIndex} variant="card">
				{TIPS.map((tip: Tip): React.JSX.Element => (
					<View key={tip.key} className="gap-1 p-4">
						<Subheading>{tip.title}</Subheading>
						<BodyText>{tip.body}</BodyText>
					</View>
				))}
			</Carousel>
			<MutedText>{`Showing tip ${String(index + POSITION_OFFSET)} of ${String(TIPS.length)}`}</MutedText>
		</>
	);
}

function ImageCarouselDemo(): React.JSX.Element {
	const [index, setIndex] = React.useState(FIRST_SLIDE);
	return <ImageCarousel images={REWARD_PHOTOS} index={index} onChange={setIndex} ratio="photo" showControls testID="demo-image-carousel" />;
}

function ImageResizerDemo(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>(RESIZER_START_SIZE);
	const [savedSize, setSavedSize] = React.useState<ImageSize>(RESIZER_START_SIZE);
	const [keepsShape, setKeepsShape] = React.useState(true);
	return (
		<>
			<Switch label="Keep the aspect ratio" checked={keepsShape} onChange={setKeepsShape} />
			{/* Room for the handles, which reach half their touch area past the picture. */}
			<View className="items-start p-6">
				<ImageResizer
					uri={APP_ICON_URI}
					alt="The app icon, resizable"
					value={size}
					onChange={setSize}
					onChangeEnd={setSavedSize}
					maxWidth={RESIZER_MAX_WIDTH_PT}
					maxHeight={RESIZER_MAX_WIDTH_PT}
					aspectRatio={keepsShape ? SQUARE_RATIO : undefined}
				/>
			</View>
			<MutedText>{`Size ${String(size.width)} × ${String(size.height)} · saved ${String(savedSize.width)} × ${String(savedSize.height)}`}</MutedText>
		</>
	);
}

function CodeBlockDemo(): React.JSX.Element {
	const [copied, setCopied] = React.useState(false);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(SIGN_IN_CODE)
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, []);
	return (
		<>
			<CodeBlock code={SIGN_IN_CODE} language="TypeScript" caption="sign-in.ts" onCopy={copy} copied={copied} />
			<CodeBlock code="pnpm run lint && pnpm run test" variant="card" size="sm" />
		</>
	);
}

interface DemoFile {
	readonly key: string;
	readonly name: string;
	readonly description: string;
}

const INITIAL_FILES: readonly DemoFile[] = [
	{ key: "menu", name: "spring-menu.jpg", description: "2.4 MB · Image" },
	{ key: "floor-plan", name: "floor-plan-level-2.jpg", description: "860 KB · Image" },
];

function AttachmentDemo(): React.JSX.Element {
	const [files, setFiles] = React.useState<readonly DemoFile[]>(INITIAL_FILES);
	const [opened, setOpened] = React.useState<string | null>(null);
	const restore = React.useCallback((): void => {
		setFiles(INITIAL_FILES);
	}, []);
	return (
		<>
			{files.map((file: DemoFile): React.JSX.Element => (
				<DemoAttachment key={file.key} file={file} onOpen={setOpened} onRemove={setFiles} />
			))}
			{files.length === INITIAL_FILES.length ? null : <Button label="Restore the removed files" variant="secondary" size="sm" onPress={restore} />}
			<Attachment name="contract-signed.pdf" description="Uploading… 40%" loading />
			<Attachment name="passport-scan.heic" description="Upload failed: HEIC is not supported" invalid />
			<MutedText>{opened === null ? "Tap a file to open it." : `Opened ${opened}`}</MutedText>
		</>
	);
}

interface DemoAttachmentProps {
	readonly file: DemoFile;
	readonly onOpen: (name: string) => void;
	readonly onRemove: React.Dispatch<React.SetStateAction<readonly DemoFile[]>>;
}

function DemoAttachment({ file, onOpen, onRemove }: DemoAttachmentProps): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(file.name);
	}, [file.name, onOpen]);
	const remove = React.useCallback((): void => {
		onRemove((current: readonly DemoFile[]): readonly DemoFile[] => current.filter((candidate: DemoFile): boolean => candidate.key !== file.key));
	}, [file.key, onRemove]);
	return <Attachment name={file.name} description={file.description} icon={ImageIcon} onPress={open} onRemove={remove} accessibilityHint="Opens the file" />;
}
