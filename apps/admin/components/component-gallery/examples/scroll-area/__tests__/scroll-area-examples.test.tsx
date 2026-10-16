// @vitest-environment jsdom
import { SCROLL_AREA_EXAMPLES } from "@/components/component-gallery/examples/scroll-area";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Scroll Area", SCROLL_AREA_EXAMPLES);
