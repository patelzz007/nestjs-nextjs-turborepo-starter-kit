// ============================================
// The UI kit gallery's screen body (@workspace/ui-native, live)
// ============================================
// A developer's gallery of every kit component, one family at a time: the
// family chips choose which section shows. This body and its sections are
// the smart side (they own the demo state); every kit component in them stays
// controlled. Nothing here reaches the API. Loaded only by a development
// bundle — app/(app)/settings/components.tsx.

import { ToggleGroup } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

import { Screen } from "../../components/screen";
import { COMPONENT_GALLERY_COPY } from "./labels";
import { DEFAULT_GALLERY_FAMILY, GALLERY_FAMILIES, nextGalleryFamily, type GalleryFamily } from "./families";
import { DataDisplayDemos } from "./sections/data-display-demos";
import { DateDemos } from "./sections/date-demos";
import { DisplayDemos } from "./sections/display-demos";
import { FormInputsDemos } from "./sections/form-inputs-demos";
import { MediaDemos } from "./sections/media-demos";
import { OverlayDemos } from "./sections/overlay-demos";
import { SelectionDemos } from "./sections/selection-demos";

const FAMILY_SECTIONS: Readonly<Record<GalleryFamily, () => React.JSX.Element>> = {
	inputs: FormInputsDemos,
	selection: SelectionDemos,
	overlays: OverlayDemos,
	display: DisplayDemos,
	data: DataDisplayDemos,
	dates: DateDemos,
	media: MediaDemos,
};

/** The gallery itself: the family chips and the chosen family's live demos. Development bundles only (see the route). */
export function ComponentGalleryScreenBody(): React.JSX.Element {
	const [family, setFamily] = React.useState<GalleryFamily>(DEFAULT_GALLERY_FAMILY);
	const chooseFamily = React.useCallback((pressed: GalleryFamily | null): void => {
		setFamily((current: GalleryFamily): GalleryFamily => nextGalleryFamily(current, pressed));
	}, []);
	const Section = FAMILY_SECTIONS[family];
	return (
		<Screen description={COMPONENT_GALLERY_COPY.description}>
			<ToggleGroup type="single" label="Component family" options={GALLERY_FAMILIES} value={family} onChange={chooseFamily} size="sm" testID="component-families" />
			<Section />
		</Screen>
	);
}
