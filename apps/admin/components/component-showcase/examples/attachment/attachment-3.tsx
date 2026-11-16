"use client";

import * as React from "react";
import Image from "next/image";
import { useCallback, useState } from "react";

import { Attachment, AttachmentContent, AttachmentGroup, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@workspace/ui/components/attachment";

interface Shot {
	readonly id: string;
	readonly name: string;
	readonly dimensions: string;
	readonly src: string;
	readonly alt: string;
}

/** The thumbnail's rendered size (px); the sources are requested at twice that density. */
const THUMBNAIL_SIZE = 120;

// Thumbnails are requested at the card width and twice the density, so the
// strip never pulls a full size screenshot down to paint a 120px square.
const SHOTS: readonly Shot[] = [
	{
		id: "gradient",
		name: "brand-gradient.png",
		dimensions: "2400 x 1600",
		src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&h=120&dpr=2&q=80",
		alt: "Purple and orange gradient artwork",
	},
	{
		id: "mesh",
		name: "mesh-backdrop.png",
		dimensions: "1800 x 1200",
		src: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=120&h=120&dpr=2&q=80",
		alt: "Blue and violet mesh render",
	},
	{
		id: "spectrum",
		name: "spectrum-wash.jpg",
		dimensions: "3000 x 2000",
		src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=120&h=120&dpr=2&q=80",
		alt: "Soft rainbow spectrum wash",
	},
	{
		id: "waves",
		name: "wave-pattern.png",
		dimensions: "1200 x 1200",
		src: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=120&h=120&dpr=2&q=80",
		alt: "Magenta and violet wave pattern",
	},
	{
		id: "ink",
		name: "ink-render.png",
		dimensions: "2000 x 1400",
		src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=120&h=120&dpr=2&q=80",
		alt: "Colourful ink dispersing in water",
	},
];

export function Attachment3Example(): React.JSX.Element {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		setSelectedId(event.currentTarget.dataset.shotId ?? null);
	}, []);

	// Boots with nothing chosen so the first click is the thing on show, and
	// the selected shot is looked up during render rather than duplicated.
	const selected = SHOTS.find((shot) => shot.id === selectedId) ?? null;

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-2">
			<AttachmentGroup role="group" aria-label="Screenshots in this thread">
				{SHOTS.map((shot) => (
					/*
					 * A vertical card takes its own fixed width, so a w-full here would
					 * collapse the strip into one column and kill the snap scrolling.
					 */
					<Attachment key={shot.id} orientation="vertical">
						<AttachmentMedia variant="image">
							{/*
							 * No classes on the image: variant="image" already crops every
							 * child img square and covers the frame. The alt describes the
							 * picture, and the title below it names the file.
							 */}
							<Image src={shot.src} alt={shot.alt} width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} />
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>{shot.name}</AttachmentTitle>
						</AttachmentContent>
						{/*
						 * The trigger reports aria-pressed because it selects rather than
						 * navigates, and it renders below the actions slot in the stacking
						 * order, so a card can carry a full card select and its own buttons.
						 */}
						<AttachmentTrigger type="button" aria-label={`Preview ${shot.name}`} aria-pressed={selectedId === shot.id} data-shot-id={shot.id} onClick={handleSelect} />
					</Attachment>
				))}
			</AttachmentGroup>
			<p className="text-xs text-muted-foreground" aria-live="polite">
				{selected ? (
					<>
						{selected.name}
						<span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle" />
						{selected.dimensions}
					</>
				) : (
					"Select a shot to see its details."
				)}
			</p>
		</div>
	);
}
