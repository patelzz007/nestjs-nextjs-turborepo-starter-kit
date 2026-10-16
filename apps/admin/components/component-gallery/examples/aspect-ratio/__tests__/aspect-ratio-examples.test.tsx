// @vitest-environment jsdom
import { ASPECT_RATIO_EXAMPLES } from "@/components/component-gallery/examples/aspect-ratio";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Aspect Ratio", ASPECT_RATIO_EXAMPLES);
