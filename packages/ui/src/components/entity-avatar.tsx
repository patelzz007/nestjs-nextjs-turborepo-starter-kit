"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { getEntityAvatarTone } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { fixedImageSizes, imageSrcSet, type ImageSourceEntry } from "@workspace/ui/lib/media/image-sources";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * Square brand mark for a named entity (a shop, tenant, team): its logo
 * when one is given, otherwise a monogram of the name on a tint picked
 * deterministically from the theme's chart palette — the same name always gets
 * the same colour, so an entity stays recognisable before it has a logo.
 */
const entityAvatarVariants = cva("shrink-0 overflow-hidden bg-background", {
	variants: {
		/** The mark's size: `sm` to `xl`. */
		size: {
			sm: "size-8",
			md: "size-10",
			lg: "size-12",
			xl: "size-16",
		},
		/** `rounded` (a rounded square) or `circle`. */
		shape: {
			rounded: "",
			circle: "rounded-full after:rounded-full",
		},
	},
	compoundVariants: [
		{ shape: "rounded", size: ["sm", "md"], className: "rounded-lg after:rounded-lg" },
		{ shape: "rounded", size: ["lg", "xl"], className: "rounded-xl after:rounded-xl" },
	],
	defaultVariants: {
		size: "md",
		shape: "rounded",
	},
});

/**
 * The monogram: foreground text on a chart-token tint, so every app theme
 * (light and dark) recolours it while the text keeps its contrast. Only the
 * four saturated chart slots are used — `chart-5` is each theme's neutral
 * (near-grey) slot, so a monogram tinted with it reads as "no colour".
 */
const entityAvatarMonogramVariants = cva("flex size-full items-center justify-center rounded-[inherit] font-semibold text-foreground uppercase", {
	variants: {
		size: {
			sm: "text-xs",
			md: "text-sm",
			lg: "text-base",
			xl: "text-xl",
		},
		tone: {
			"chart-1": "bg-chart-1/20",
			"chart-2": "bg-chart-2/20",
			"chart-3": "bg-chart-3/20",
			"chart-4": "bg-chart-4/20",
		},
	},
	defaultVariants: {
		size: "md",
		tone: "chart-1",
	},
});

export type { EntityAvatarTone } from "@workspace/shared";
export { getEntityAvatarTone };

export interface EntityAvatarProps extends Omit<React.ComponentPropsWithoutRef<"span">, "children">, VariantProps<typeof entityAvatarVariants> {
	/** The entity's display name — drives the monogram, its tint and the default accessible name. */
	readonly name: string;
	/** Logo URL; `null`/omitted (or an image that fails to load) shows the monogram. */
	readonly src?: string | null | undefined;
	/** The logo's renditions, smallest first — served with `srcset` at the size the mark is drawn. */
	readonly sources?: readonly ImageSourceEntry[] | undefined;
	/**
	 * Accessible name, `<img alt>` semantics: defaults to `name`. Pass `""` when
	 * the name is already rendered as adjacent text — the mark is then
	 * decorative and hidden from assistive technology, so it isn't read twice.
	 */
	readonly alt?: string | undefined;
}

/**
 * Logo-or-monogram mark for a named entity. Data-agnostic: the caller decides
 * what the entity is and where `src` comes from. Logos load lazily, in place,
 * `object-contain` on a neutral surface (never cropped); until a logo has
 * loaded — or if it fails — the monogram is shown.
 */
/** How wide each size draws the mark, in CSS pixels (`size-8` … `size-16`) — the `sizes` of its `srcset`. */
const ENTITY_AVATAR_PX: Readonly<Record<NonNullable<EntityAvatarProps["size"]>, number>> = { sm: 32, md: 40, lg: 48, xl: 64 };

/** An organisation's, a store's or a team's mark: its logo, or a monogram from its name in a tint derived from the name. */
const EntityAvatar = React.forwardRef<HTMLSpanElement, EntityAvatarProps>(function EntityAvatar(
	{ name, src, sources, alt, size, shape, className, ...props },
	ref,
): React.JSX.Element {
	const accessibleName = alt ?? name;
	const isDecorative = accessibleName.length === 0;
	const hasImage = src !== null && src !== undefined && src.length > 0;
	const tone = getEntityAvatarTone(name);

	return (
		<Avatar ref={ref} data-slot="entity-avatar" aria-hidden={isDecorative ? true : undefined} className={cn(entityAvatarVariants({ size, shape }), className)} {...props}>
			{hasImage ? (
				<AvatarImage
					keepMounted
					src={src}
					srcSet={imageSrcSet(sources)}
					sizes={fixedImageSizes(ENTITY_AVATAR_PX[size ?? "md"])}
					alt={accessibleName}
					loading="lazy"
					decoding="async"
					className="absolute inset-0 rounded-[inherit] object-contain p-1 data-error:hidden data-loading:opacity-0"
				/>
			) : null}
			<AvatarFallback data-tone={tone} className={entityAvatarMonogramVariants({ size, tone })}>
				<span aria-hidden="true">{getUserInitials(name)}</span>
				{isDecorative ? null : <span className="sr-only">{accessibleName}</span>}
			</AvatarFallback>
		</Avatar>
	);
});
EntityAvatar.displayName = "EntityAvatar";

export { EntityAvatar, entityAvatarVariants };
