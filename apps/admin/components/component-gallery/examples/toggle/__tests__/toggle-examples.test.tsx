// @vitest-environment jsdom
import { TOGGLE_EXAMPLES } from "@/components/component-gallery/examples/toggle";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Toggle", TOGGLE_EXAMPLES);
