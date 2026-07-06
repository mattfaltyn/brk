import {
  appendLegendListItem,
  createLegendItem,
  createLegendList,
} from "../../../legend/index.js";
import { formatFeeRate } from "../../../utils/fee-rate.js";
import { FEE_BUCKETS } from "./fees.js";

/**
 * @param {number[]} ranges
 */
export function createPreviewLegend(ranges) {
  const list = createLegendList({ scroll: true });

  for (let index = 0; index < FEE_BUCKETS.length; index += 1) {
    const bucket = FEE_BUCKETS[index];
    const { button, value } = createLegendItem({
      label: bucket.label,
      color: bucket.color,
      ariaLabel: `${bucket.label} fee rate percentile`,
      detail: "sat/vB",
    });

    value.textContent = formatFeeRate(ranges[index]);
    appendLegendListItem(list, button);
  }

  return list;
}
