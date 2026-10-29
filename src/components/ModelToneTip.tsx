import { useStrings } from "../lib/i18n";
import { HelpTip } from "./HelpTip";

/**
 * A "?" next to the model picker for models that shift the overall tone of the
 * picture a little. Renders nothing for the models that don't.
 */
export function ModelToneTip({ model }: { model?: { value: string } }) {
  const s = useStrings();
  const tip = model ? s.upscale.toneTips[model.value] : undefined;
  return tip ? <HelpTip tip={tip} /> : null;
}
