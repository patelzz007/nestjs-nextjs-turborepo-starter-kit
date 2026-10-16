// @vitest-environment jsdom
import { POPOVER_EXAMPLES } from "@/components/component-gallery/examples/popover";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Popover", POPOVER_EXAMPLES);
