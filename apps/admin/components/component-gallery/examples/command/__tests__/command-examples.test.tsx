// @vitest-environment jsdom
import { COMMAND_EXAMPLES } from "@/components/component-gallery/examples/command";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Command", COMMAND_EXAMPLES);
