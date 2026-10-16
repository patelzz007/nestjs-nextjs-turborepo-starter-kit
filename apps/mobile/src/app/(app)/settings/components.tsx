// ============================================
// Components — the React Native UI kit (@workspace/ui-native), live
// ============================================
// A developer's gallery of every kit component, one family at a time: the
// family chips choose which section shows. This screen and its sections are
// the smart side (they own the demo state); every kit component in them stays
// controlled. Nothing here reaches the API.

import { ToggleGroup } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

import { Screen } from "../../../components/screen";
import { DEFAULT_GALLERY_FAMILY, GALLERY_FAMILIES, nextGalleryFamily, type GalleryFamily } from "../../../features/component-gallery/families";
import { DataDisplayDemos } from "../../../features/component-gallery/sections/data-display-demos";
import { DateDemos } from "../../../features/component-gallery/sections/date-demos";
import { DisplayDemos } from "../../../features/component-gallery/sections/display-demos";
import { FormInputsDemos } from "../../../features/component-gallery/sections/form-inputs-demos";
import { MediaDemos } from "../../../features/component-gallery/sections/media-demos";
import { OverlayDemos } from "../../../features/component-gallery/sections/overlay-demos";
import { SelectionDemos } from "../../../features/component-gallery/sections/selection-demos";

const FAMILY_SECTIONS: Readonly<Record<GalleryFamily, () => React.JSX.Element>> = {
	inputs: FormInputsDemos,
	selection: SelectionDemos,
	overlays: OverlayDemos,
	display: DisplayDemos,
	data: DataDisplayDemos,
	dates: DateDemos,
	media: MediaDemos,
};

export default function ComponentsScreen(): React.JSX.Element {
	const [family, setFamily] = React.useState<GalleryFamily>(DEFAULT_GALLERY_FAMILY);
	const chooseFamily = React.useCallback((pressed: GalleryFamily | null): void => {
		setFamily((current: GalleryFamily): GalleryFamily => nextGalleryFamily(current, pressed));
	}, []);
	const Section = FAMILY_SECTIONS[family];
	return (
		<Screen description="Every component of the mobile UI kit, live. Pick a family to see its components in each variant, size and state.">
			<ToggleGroup type="single" label="Component family" options={GALLERY_FAMILIES} value={family} onChange={chooseFamily} size="sm" testID="component-families" />
			<Section />
		</Screen>
	);
}
