// @vitest-environment jsdom
import { FRAME_EXAMPLES } from "@/components/component-gallery/examples/frame";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Frame", FRAME_EXAMPLES);
