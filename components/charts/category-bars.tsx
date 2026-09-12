'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtNum } from '@/lib/format';
import type { Locale } from '@/lib/i18n/dictionaries';
import { CURSOR, GRID, LATE, SERIES, TICK, TOOLTIP_STYLE } from './chart-theme';

export type CategoryDatum = {
  label: string;
  value: number;
  /** Draws this row in the alarm colour — used for the "late"/"expired" share. */
  alarm?: boolean;
};

/**
 * One measure across a handful of named categories (places, departments).
 *
 * Deliberately single-hue: identity comes from the row label, not from colour.
 * Colouring each bar differently would need a categorical palette, and this
 * design system does not have one that survives a colour-vision check — its
 * blue ramp fails at ΔE 10.8 between adjacent steps. `alarm` is the one
 * exception and is reserved for genuinely bad states, matching the way magenta
 * is used everywhere else in the app.
 */
export function CategoryBars({
  data,
  locale,
  valueLabel,
  rowHeight = 28,
  labelWidth = 120,
}: {
  data: CategoryDatum[];
  locale: Locale;
  /** Series name shown in the tooltip. */
  valueLabel: string;
  rowHeight?: number;
  labelWidth?: number;
}) {
  const fmt = (n: number) => fmtNum(n, locale);
  // Grow with the data instead of squeezing rows into a fixed box; recharts
  // silently drops category ticks it cannot fit.
  const height = Math.max(rowHeight * data.length + 24, 80);

  return (
    // See TrendChart for why this reset is here and why it is not a
    // [dir=rtl] override.
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={TICK}
            tickFormatter={fmt}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={TICK}
            interval={0}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ fill: CURSOR }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [fmt(Number(v)), valueLabel]}
          />
          <Bar dataKey="value" name={valueLabel} isAnimationActive={false} radius={[0, 2, 2, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.alarm ? LATE : SERIES} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
