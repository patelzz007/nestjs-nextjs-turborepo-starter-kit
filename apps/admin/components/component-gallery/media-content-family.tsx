"use client";

import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
	type AttachmentState,
} from "@workspace/ui/components/attachment";
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
import {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockTitle,
	CodeBlockWrapToggle,
} from "@workspace/ui/components/code-block";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui/components/image-carousel";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "@workspace/ui/components/message";
import { QrCode } from "@workspace/ui/components/qr-code";
import { UserAvatar } from "@workspace/ui/components/user-avatar";
import { FileText, ImageOff, RotateCcw, X } from "lucide-react";
import * as React from "react";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue, ExampleOnlySections } from "@/components/component-gallery/gallery-section";

// ── Sample media ────────────────────────────────────────────────────────────
// Sample photos come from Unsplash's CDN — the image host the admin already
// allows (`next.config.ts` → `images.remotePatterns`).

/** Width requested from the image CDN for the demo photos. */
const SAMPLE_PHOTO_WIDTH_PX = 800;
/** Width requested for the avatar photo. */
const AVATAR_PHOTO_WIDTH_PX = 128;

function unsplashPhoto(photoId: string, widthPx: number): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${String(widthPx)}&q=80`;
}

const WORKSPACE_PHOTO = unsplashPhoto("photo-1486312338219-ce68d2c6f44d", SAMPLE_PHOTO_WIDTH_PX);
const CODE_PHOTO = unsplashPhoto("photo-1461749280684-dccba630e2f6", SAMPLE_PHOTO_WIDTH_PX);
const NETWORK_PHOTO = unsplashPhoto("photo-1451187580459-43490279c0fa", SAMPLE_PHOTO_WIDTH_PX);
const TEAM_PHOTO = unsplashPhoto("photo-1504384308090-c894fdcc538d", SAMPLE_PHOTO_WIDTH_PX);
const PORTRAIT_PHOTO = unsplashPhoto("photo-1504384308090-c894fdcc538d", AVATAR_PHOTO_WIDTH_PX);

/** A URL that never resolves, to show each image component's fallback. */
const BROKEN_IMAGE_URL = "https://images.unsplash.com/photo-does-not-exist";

const WIDE_RATIO = 16 / 9;
const SQUARE_RATIO = 1;
/** Pixel size the user avatar is drawn at (picks the rendition). */
const USER_AVATAR_DRAWN_PX = 40;

// ── Avatars ─────────────────────────────────────────────────────────────────

const TEAM_INITIALS: readonly string[] = ["AL", "GH", "KJ"];
/** Members of the sample team beyond the avatars shown. */
const HIDDEN_TEAM_MEMBERS = 5;

function AvatarDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Sizes, image and fallback">
				<Avatar size="sm">
					<AvatarImage src={PORTRAIT_PHOTO} alt="Team photo" />
					<AvatarFallback>TP</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src={PORTRAIT_PHOTO} alt="Team photo" />
					<AvatarFallback>TP</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage src={BROKEN_IMAGE_URL} alt="Missing photo" />
					<AvatarFallback>AL</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarFallback>GH</AvatarFallback>
					<AvatarBadge className="bg-success" />
				</Avatar>
			</DemoRow>
			<DemoRow label="Group">
				<AvatarGroup>
					{TEAM_INITIALS.map((initials) => (
						<Avatar key={initials}>
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
					))}
					<AvatarGroupCount>+{HIDDEN_TEAM_MEMBERS}</AvatarGroupCount>
				</AvatarGroup>
			</DemoRow>
		</DemoSurface>
	);
}

function UserAvatarDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Photo, initials and a broken photo">
				<UserAvatar name="Grace Hopper" image={{ url: PORTRAIT_PHOTO }} drawnSize={USER_AVATAR_DRAWN_PX} className="size-10" />
				<UserAvatar name="Ada Lovelace" image={null} drawnSize={USER_AVATAR_DRAWN_PX} className="size-10" />
				<UserAvatar name="Katherine Johnson" image={{ url: BROKEN_IMAGE_URL }} drawnSize={USER_AVATAR_DRAWN_PX} className="size-10" />
			</DemoRow>
		</DemoSurface>
	);
}

const ENTITY_NAMES: readonly string[] = ["Acme Coffee", "Bayview Books", "Corner Bakery", "Delta Fitness"];

function EntityAvatarDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Monograms (the tone comes from the name)">
				{ENTITY_NAMES.map((name) => (
					<EntityAvatar key={name} name={name} size="lg" />
				))}
			</DemoRow>
			<DemoRow label="Logo, sizes and shapes">
				<EntityAvatar name="Workspace" src={WORKSPACE_PHOTO} size="lg" alt="Workspace logo" />
				<EntityAvatar name="Small" size="sm" />
				<EntityAvatar name="Medium" size="md" />
				<EntityAvatar name="Extra large" size="xl" />
				<EntityAvatar name="Circle" size="lg" shape="circle" />
			</DemoRow>
		</DemoSurface>
	);
}

// ── Aspect ratio & cover image ──────────────────────────────────────────────

function AspectRatioDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="grid max-w-2xl gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">16 : 9</p>
					<AspectRatio ratio={WIDE_RATIO} className="overflow-hidden rounded-lg bg-muted">
						<div className="flex size-full items-center justify-center text-sm text-muted-foreground">16 : 9</div>
					</AspectRatio>
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">1 : 1</p>
					<AspectRatio ratio={SQUARE_RATIO} className="overflow-hidden rounded-lg bg-muted">
						<div className="flex size-full items-center justify-center text-sm text-muted-foreground">1 : 1</div>
					</AspectRatio>
				</div>
			</div>
		</DemoSurface>
	);
}

const COVER_FALLBACK: React.ReactNode = (
	<div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
		<ImageOff className="size-5" aria-hidden="true" />
		No image
	</div>
);

function CoverImageDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">Loaded</p>
					<CoverImage src={CODE_PHOTO} alt="Code on a laptop screen" className="rounded-lg" />
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">Failed to load (fallback)</p>
					<CoverImage src={BROKEN_IMAGE_URL} alt="Missing cover" fallback={COVER_FALLBACK} className="rounded-lg" />
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">No source (fallback)</p>
					<CoverImage src={null} alt="No cover" fallback={COVER_FALLBACK} className="rounded-lg" />
				</div>
			</div>
		</DemoSurface>
	);
}

// ── Carousels ───────────────────────────────────────────────────────────────

const SLIDE_NUMBERS: readonly number[] = [1, 2, 3, 4, 5];

function CarouselDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="px-12">
				<Carousel className="mx-auto w-full max-w-sm">
					<CarouselContent>
						{SLIDE_NUMBERS.map((slide) => (
							<CarouselItem key={slide}>
								<AspectRatio ratio={SQUARE_RATIO} className="flex items-center justify-center rounded-lg border bg-muted">
									<span className="text-4xl font-semibold tabular-nums">{slide}</span>
								</AspectRatio>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious />
					<CarouselNext />
				</Carousel>
			</div>
		</DemoSurface>
	);
}

const CAROUSEL_IMAGES: readonly ImageCarouselImage[] = [
	{ id: "workspace", src: WORKSPACE_PHOTO, alt: "A laptop on a desk" },
	{ id: "code", src: CODE_PHOTO, alt: "Code on a screen" },
	{ id: "network", src: NETWORK_PHOTO, alt: "The earth at night" },
	{ id: "team", src: TEAM_PHOTO, alt: "A team at work" },
];

function ImageCarouselDemo(): React.JSX.Element {
	const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

	return (
		<DemoSurface>
			<div className="mx-auto w-full max-w-lg">
				<ImageCarousel images={CAROUSEL_IMAGES} onSelectedIndexChange={setSelectedIndex} frameClassName="rounded-lg" />
			</div>
			<DemoValue label="Photo">
				{selectedIndex + 1} of {CAROUSEL_IMAGES.length}
			</DemoValue>
		</DemoSurface>
	);
}

// ── Attachment ──────────────────────────────────────────────────────────────

interface DemoAttachment {
	readonly id: string;
	readonly name: string;
	readonly detail: string;
	readonly state: AttachmentState;
}

const INITIAL_ATTACHMENTS: readonly DemoAttachment[] = [
	{ id: "contract", name: "merchant-contract.pdf", detail: "1.2 MB", state: "done" },
	{ id: "logo", name: "store-logo.png", detail: "Uploading… 64%", state: "uploading" },
	{ id: "menu", name: "menu-2026.pdf", detail: "Scanning for viruses…", state: "processing" },
	{ id: "license", name: "business-license.jpg", detail: "Upload failed — retry", state: "error" },
	{ id: "notes", name: "notes.txt", detail: "Ready to upload", state: "idle" },
];

interface AttachmentChipProps {
	readonly attachment: DemoAttachment;
	readonly onRemove: (id: string) => void;
}

/** One file chip; reports its own id, so the list binds no closure per item. */
function AttachmentChip({ attachment, onRemove }: AttachmentChipProps): React.JSX.Element {
	const handleRemove = React.useCallback((): void => {
		onRemove(attachment.id);
	}, [attachment.id, onRemove]);

	return (
		<Attachment state={attachment.state}>
			<AttachmentMedia>
				<FileText />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{attachment.name}</AttachmentTitle>
				<AttachmentDescription>{attachment.detail}</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<AttachmentAction aria-label={`Remove ${attachment.name}`} onClick={handleRemove}>
					<X />
				</AttachmentAction>
			</AttachmentActions>
		</Attachment>
	);
}

function AttachmentDemo(): React.JSX.Element {
	const [attachments, setAttachments] = React.useState<readonly DemoAttachment[]>(INITIAL_ATTACHMENTS);

	const handleRemove = React.useCallback((id: string): void => {
		setAttachments((current) => current.filter((attachment) => attachment.id !== id));
	}, []);

	const handleReset = React.useCallback((): void => {
		setAttachments(INITIAL_ATTACHMENTS);
	}, []);

	return (
		<DemoSurface>
			<AttachmentGroup>
				{attachments.map((attachment) => (
					<AttachmentChip key={attachment.id} attachment={attachment} onRemove={handleRemove} />
				))}
			</AttachmentGroup>
			<DemoRow label="Vertical and small">
				<Attachment orientation="vertical">
					<AttachmentMedia>
						<FileText />
					</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>report.pdf</AttachmentTitle>
						<AttachmentDescription>2.4 MB</AttachmentDescription>
					</AttachmentContent>
				</Attachment>
				<Attachment size="sm">
					<AttachmentMedia>
						<FileText />
					</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>invoice.pdf</AttachmentTitle>
					</AttachmentContent>
				</Attachment>
			</DemoRow>
			<div>
				<Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={attachments.length === INITIAL_ATTACHMENTS.length}>
					<RotateCcw data-icon="inline-start" />
					Restore removed files
				</Button>
			</div>
		</DemoSurface>
	);
}

// ── Chat: bubble & message ──────────────────────────────────────────────────

function BubbleDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<BubbleGroup className="max-w-md">
				<Bubble>
					<BubbleContent>Default bubble — the other person&apos;s message.</BubbleContent>
				</Bubble>
				<Bubble variant="secondary" align="end">
					<BubbleContent>Secondary, aligned to the end — your reply.</BubbleContent>
				</Bubble>
				<Bubble variant="muted">
					<BubbleContent>Muted, for system notes.</BubbleContent>
				</Bubble>
				<Bubble variant="tinted" align="end" className="mb-4">
					<BubbleContent>Tinted, with reactions.</BubbleContent>
					<BubbleReactions>
						<span className="rounded-full border bg-background px-1.5 text-xs">👍 2</span>
					</BubbleReactions>
				</Bubble>
				<Bubble variant="outline">
					<BubbleContent>Outline.</BubbleContent>
				</Bubble>
				<Bubble variant="destructive" align="end">
					<BubbleContent>Destructive — the message failed to send.</BubbleContent>
				</Bubble>
			</BubbleGroup>
		</DemoSurface>
	);
}

interface SentReply {
	readonly id: number;
	readonly text: string;
}

const NO_REPLIES: readonly SentReply[] = [];

function MessageDemo(): React.JSX.Element {
	const [reply, setReply] = React.useState<string>("");
	const [sentReplies, setSentReplies] = React.useState<readonly SentReply[]>(NO_REPLIES);

	const handleReplyChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReply(event.currentTarget.value);
	}, []);

	const handleSend = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const text = reply.trim();
			if (text.length === 0) {
				return;
			}
			// Replies are append-only, so the next position is a stable, unique id.
			setSentReplies((current) => [...current, { id: current.length + 1, text }]);
			setReply("");
		},
		[reply],
	);

	return (
		<DemoSurface>
			<MessageGroup className="max-w-lg">
				<Message>
					<MessageAvatar>
						<UserAvatar name="Grace Hopper" image={null} drawnSize={USER_AVATAR_DRAWN_PX} />
					</MessageAvatar>
					<MessageContent>
						<MessageHeader>Grace Hopper · 09:41</MessageHeader>
						<Bubble>
							<BubbleContent>Can you approve the Acme Coffee rewards today?</BubbleContent>
						</Bubble>
						<MessageFooter>Read</MessageFooter>
					</MessageContent>
				</Message>
				{sentReplies.map((sent) => (
					<Message key={sent.id} align="end">
						<MessageContent>
							<Bubble variant="secondary" align="end">
								<BubbleContent>{sent.text}</BubbleContent>
							</Bubble>
						</MessageContent>
					</Message>
				))}
			</MessageGroup>
			<form onSubmit={handleSend} className="flex max-w-lg items-end gap-2">
				<div className="flex flex-1 flex-col gap-1.5">
					<Label htmlFor="gallery-message-reply">Reply</Label>
					<Input id="gallery-message-reply" value={reply} onChange={handleReplyChange} placeholder="Type a reply" />
				</div>
				<Button type="submit" disabled={reply.trim().length === 0}>
					Send
				</Button>
			</form>
		</DemoSurface>
	);
}

// ── Code block & QR code ────────────────────────────────────────────────────

const SAMPLE_CODE = `import { Button } from "@workspace/ui/components/button";

export function SaveButton({ isSaving }: { readonly isSaving: boolean }): React.JSX.Element {
	return (
		<Button type="submit" loading={isSaving}>
			Save
		</Button>
	);
}`;
const SAMPLE_CODE_TITLE = "save-button.tsx";
const SAMPLE_CODE_HIGHLIGHTED_LINES: readonly number[] = [5];

function CodeBlockDemo(): React.JSX.Element {
	const highlightedLines = React.useMemo((): number[] => [...SAMPLE_CODE_HIGHLIGHTED_LINES], []);
	return (
		<DemoSurface>
			<CodeBlock code={SAMPLE_CODE} language="tsx" label={SAMPLE_CODE_TITLE} showLineNumbers highlightedLines={highlightedLines}>
				<CodeBlockHeader>
					<CodeBlockTitle>{SAMPLE_CODE_TITLE}</CodeBlockTitle>
					<CodeBlockLanguage>tsx</CodeBlockLanguage>
					<div className="ms-auto flex items-center gap-1">
						<CodeBlockWrapToggle />
						<CodeBlockDownloadButton position="inline" filename={SAMPLE_CODE_TITLE} />
						<CodeBlockCopyButton />
					</div>
				</CodeBlockHeader>
			</CodeBlock>
		</DemoSurface>
	);
}

const DEFAULT_QR_VALUE = "https://acme.example/claim/R-2026-0042";
/** Drawn sizes of the QR examples, in pixels. */
const QR_SIZE_SMALL_PX = 96;
const QR_SIZE_LARGE_PX = 160;

function QrCodeDemo(): React.JSX.Element {
	const [value, setValue] = React.useState<string>(DEFAULT_QR_VALUE);
	const qrValue = value.length > 0 ? value : DEFAULT_QR_VALUE;

	const handleValueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValue(event.currentTarget.value);
	}, []);

	return (
		<DemoSurface>
			<div className="flex w-full max-w-md flex-col gap-1.5">
				<Label htmlFor="gallery-qr-value">Encoded value</Label>
				<Input id="gallery-qr-value" value={value} onChange={handleValueChange} />
			</div>
			<DemoRow label="Sizes" className="items-end">
				<QrCode value={qrValue} size={QR_SIZE_SMALL_PX} label="QR code of the encoded value (small)" />
				<QrCode value={qrValue} size={QR_SIZE_LARGE_PX} label="QR code of the encoded value (large)" />
			</DemoRow>
		</DemoSurface>
	);
}

/** Media & content: people, images, files, chat and code. Smart: owns every demo's state. */
export function MediaContentFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.avatar} height="h-40">
				<AvatarDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.userAvatar} height="h-24">
				<UserAvatarDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.entityAvatar} height="h-40">
				<EntityAvatarDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.aspectRatio} height="h-72">
				<AspectRatioDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.coverImage} height="h-56">
				<CoverImageDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.carousel} height="h-[400px]">
				<CarouselDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.imageCarousel} height="h-96">
				<ImageCarouselDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.attachment} height="h-72">
				<AttachmentDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.bubble} height="h-96">
				<BubbleDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.message} height="h-72">
				<MessageDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.codeBlock} height="h-72">
				<CodeBlockDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.qrCode} height="h-72">
				<QrCodeDemo />
			</ComponentSection>
			<ExampleOnlySections familyId="family-media-content" />
		</>
	);
}
