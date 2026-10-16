// @vitest-environment jsdom
import { MENUBAR_EXAMPLES } from "@/components/component-gallery/examples/menubar";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Menubar", MENUBAR_EXAMPLES);
