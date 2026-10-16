// @vitest-environment jsdom
import { COLLAPSIBLE_EXAMPLES } from "@/components/component-gallery/examples/collapsible";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Collapsible", COLLAPSIBLE_EXAMPLES);
