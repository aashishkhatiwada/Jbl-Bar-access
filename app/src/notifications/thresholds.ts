// Rear speaker low-battery threshold, read statically from the bar's
// firmware. See docs/battery-trigger.md for method and provenance.
//
// bdpprog (JBL Bar 9.1 firmware 21.23.11.80) shows the native low-battery
// message when a rear battery byte b satisfies (uint8)(b − 1) <= 13, i.e.
// 1 ≤ b ≤ 14 (after stripping a +100 "charging" offset). 0 is never low.
// The bar's own bdpprog (build 310669) differs from the analysed one; unconfirmed there.
export const REAR_LOW_BATTERY_PERCENT = 14; // measured: static, bdpprog 21.23.11.80

// Re-arm once the battery is clearly above the threshold again.
export const REARM_MARGIN = 5;
