// @vitest-environment jsdom
import { SWITCH_EXAMPLES } from "@/components/component-gallery/examples/switch";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Switch", SWITCH_EXAMPLES);
