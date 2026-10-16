// @vitest-environment jsdom
import { CONTEXT_MENU_EXAMPLES } from "@/components/component-gallery/examples/context-menu";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Context Menu", CONTEXT_MENU_EXAMPLES);
