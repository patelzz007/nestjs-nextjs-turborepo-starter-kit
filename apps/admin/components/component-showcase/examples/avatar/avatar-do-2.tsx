import * as React from "react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";

const PHOTO = "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80";

export function AvatarDo2Example(): React.JSX.Element {
	return (
		<AvatarGroup aria-label="Ada, Alan, Grace and 9 others">
			<Avatar>
				<AvatarImage src={PHOTO} alt="Ada Lovelace" />
				<AvatarFallback>AL</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarImage src={PHOTO} alt="Alan Turing" />
				<AvatarFallback>AT</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarImage src={PHOTO} alt="Grace Hopper" />
				<AvatarFallback>GH</AvatarFallback>
			</Avatar>
			<AvatarGroupCount>+9</AvatarGroupCount>
		</AvatarGroup>
	);
}
