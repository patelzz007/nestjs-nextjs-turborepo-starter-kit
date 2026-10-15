// One picture over the whole screen, as large as it fits, on the dark scrim:
// what tapping a picture in a comment opens. Closed by its close button or the
// system back; "Open in browser" hands the picture's address to the browser.
// Presentational and controlled: the caller owns `source` (`null` is closed).

import { Image } from "expo-image";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import type { ImageSource } from "../lib/api-image-authorization";
import { openableHref } from "../lib/markdown";
import { Icon, type LucideIcon } from "./icon";

const StyledImage = withUniwind(Image);

/** Space between the safe area's edge and the viewer's buttons. */
const VIEWER_EDGE_GAP = 8;

export interface ImageViewerProps {
	/** The picture shown, and the headers it loads with; `null` while closed. */
	readonly source: ImageSource | null;
	/** Read to screen readers in place of the picture. */
	readonly description: string;
	/** Where "Open in browser" goes — the picture's own address; absent hides the button. */
	readonly browserUrl?: string | null | undefined;
	readonly onClose: () => void;
}

export function ImageViewer({ source, description, browserUrl, onClose }: ImageViewerProps): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const openable = browserUrl === undefined || browserUrl === null ? null : openableHref(browserUrl);
	const openInBrowser = React.useCallback((): void => {
		if (openable !== null) {
			Linking.openURL(openable).catch((): void => undefined);
		}
	}, [openable]);
	return (
		<Modal visible={source !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<View accessibilityViewIsModal className="flex-1 bg-scrim" testID="image-viewer">
				{source === null ? null : <StyledImage source={source} contentFit="contain" accessibilityLabel={description} className="flex-1" testID="image-viewer-image" />}
				<View className="absolute right-3 flex-row gap-2" style={{ top: insets.top + VIEWER_EDGE_GAP }}>
					{openable === null ? null : <ViewerButton icon={ExternalLinkIcon} label="Open in browser" onPress={openInBrowser} />}
					<ViewerButton icon={XIcon} label="Close image" onPress={onClose} />
				</View>
			</View>
		</Modal>
	);
}

interface ViewerButtonProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onPress: () => void;
}

/** A round button that stays readable over any picture. */
function ViewerButton({ icon, label, onPress }: ViewerButtonProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			hitSlop={8}
			className="size-11 items-center justify-center rounded-full bg-popover active:opacity-70">
			<Icon icon={icon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
}
