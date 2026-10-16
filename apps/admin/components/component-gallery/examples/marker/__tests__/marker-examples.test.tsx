// @vitest-environment jsdom
import { MARKER_EXAMPLES } from "@/components/component-gallery/examples/marker";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Marker", MARKER_EXAMPLES);
