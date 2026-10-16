// @vitest-environment jsdom
import { BUTTON_EXAMPLES } from "@/components/component-gallery/examples/button";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Button", BUTTON_EXAMPLES);
