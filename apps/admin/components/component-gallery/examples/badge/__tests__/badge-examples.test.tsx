// @vitest-environment jsdom
import { BADGE_EXAMPLES } from "@/components/component-gallery/examples/badge";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Badge", BADGE_EXAMPLES);
