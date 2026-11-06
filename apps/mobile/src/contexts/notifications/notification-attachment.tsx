// A notification's optional file (ADR 070), in the feed and in the opened message: a photo at its smaller copy, or a
// PDF as a file chip. The 4K original is only loaded when the person asks to see it.

import { formatBytes, type NotificationAttachmentResponse } from "@workspace/shared";
import { Attachment } from "@workspace/ui-native/components/attachment";
import { Image } from "expo-image";
import FileTextIcon from "lucide-react-native/icons/file-text";
import * as React from "react";
import { Pressable } from "react-native";
import { withUniwind } from "uniwind";

import { NOTIFICATIONS_COPY } from "./labels";

const StyledImage = withUniwind(Image);

export function isPhotoAttachment(attachment: NotificationAttachmentResponse): boolean {
	return attachment.mimeType !== "application/pdf";
}

export interface NotificationAttachmentViewProps {
	readonly attachment: NotificationAttachmentResponse;
	readonly onPress: () => void;
	readonly className?: string;
	readonly testID?: string;
}

export function NotificationAttachmentView({ attachment, onPress, className, testID }: NotificationAttachmentViewProps): React.JSX.Element {
	if (!isPhotoAttachment(attachment)) {
		return (
			<Attachment
				name={attachment.name}
				description={NOTIFICATIONS_COPY.attachmentDetail(formatBytes(attachment.sizeBytes))}
				icon={FileTextIcon}
				onPress={onPress}
				accessibilityHint={NOTIFICATIONS_COPY.openAttachment}
				{...(className === undefined ? {} : { className })}
				{...(testID === undefined ? {} : { testID })}
			/>
		);
	}
	return (
		<Pressable
			accessibilityRole="imagebutton"
			accessibilityLabel={attachment.name}
			accessibilityHint={NOTIFICATIONS_COPY.openAttachment}
			onPress={onPress}
			{...(className === undefined ? {} : { className })}
			{...(testID === undefined ? {} : { testID })}>
			<StyledImage source={{ uri: attachment.previewUrl ?? attachment.url }} contentFit="cover" transition={150} className="aspect-video w-full rounded-xl bg-muted" />
		</Pressable>
	);
}
