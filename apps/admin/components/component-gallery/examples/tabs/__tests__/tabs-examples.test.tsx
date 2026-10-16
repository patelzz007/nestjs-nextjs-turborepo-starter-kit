// @vitest-environment jsdom
import { TABS_EXAMPLES } from "@/components/component-gallery/examples/tabs";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Tabs", TABS_EXAMPLES);
