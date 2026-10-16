// @vitest-environment jsdom
import { TIMELINE_EXAMPLES } from "@/components/component-gallery/examples/timeline";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Timeline", TIMELINE_EXAMPLES);
