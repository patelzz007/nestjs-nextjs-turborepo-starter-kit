// @vitest-environment jsdom
import { RATING_EXAMPLES } from "@/components/component-gallery/examples/rating";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Rating", RATING_EXAMPLES);
