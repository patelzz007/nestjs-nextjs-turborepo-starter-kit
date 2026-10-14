"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/core/utils";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { fixedImageSizes, imageSrcSet, type ResponsiveImage } from "@workspace/ui/lib/media/image-sources";
import * as React from "react";

export interface UserAvatarProps {
	/** The person's name — its initials show until (or instead of) the picture. */
	readonly name: string;
	/** Their profile picture, with its renditions; `null`/omitted shows the initials. */
	readonly image?: ResponsiveImage | null | undefined;
	/** How wide the avatar is drawn, in CSS pixels — picks the smallest rendition that is sharp at that size. */
	readonly drawnSize: number;
	/**
	 * `<img alt>`: empty by default, because the name is almost always shown
	 * beside the avatar (a decorative picture is not read twice).
	 */
	readonly alt?: string | undefined;
	readonly className?: string | undefined;
	readonly fallbackClassName?: string | undefined;
}

/**
 * A person's round avatar: their profile picture (served from its renditions
 * with `srcset`), or their initials while it loads, if it fails, or when they
 * have none. Data-agnostic: the caller passes the image it got from the API.
 */
const UserAvatar = React.forwardRef<HTMLSpanElement, UserAvatarProps>(function UserAvatar(
	{ name, image, drawnSize, alt = "", className, fallbackClassName },
	ref,
): React.JSX.Element {
	const hasImage = image !== null && image !== undefined && image.url.length > 0;
	return (
		<Avatar ref={ref} data-slot="user-avatar" className={className}>
			{hasImage ? <AvatarImage src={image.url} srcSet={imageSrcSet(image.sources)} sizes={fixedImageSizes(drawnSize)} alt={alt} className="object-cover" /> : null}
			<AvatarFallback className={cn("rounded-full", fallbackClassName)}>{getUserInitials(name)}</AvatarFallback>
		</Avatar>
	);
});
UserAvatar.displayName = "UserAvatar";

export { UserAvatar };
