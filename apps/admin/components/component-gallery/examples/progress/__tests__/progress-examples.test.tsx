// @vitest-environment jsdom
import { PROGRESS_EXAMPLES } from "@/components/component-gallery/examples/progress";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Progress", PROGRESS_EXAMPLES);
