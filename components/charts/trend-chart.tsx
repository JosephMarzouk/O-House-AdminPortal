'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtNum } from '@/lib/format';
import type { Locale } from '@/lib/i18n/dictionaries';
import { AXIS, GRID, LATE, SERIES, TICK, TOOLTIP_STYLE } from './chart-theme';

export type TrendPoint = {
  /** Short axis label, already formatted server-side (e.g. "8 Sep"). */
  label: string;
  onTime: number;
  late: number;
};

/**
 * Submissions per day over the window, split on-time vs late.
 *
 * The only chart here with real axes, and the only reason recharts is a
 * dependency at all — the category breakdowns are plain CSS bars, which mirror
 * correctly under RTL for free.
 *
 * Labels arrive pre-formatted and translated: lib/i18n/index.ts is server-only
 * (it reads next/headers) so a dictionary cannot cross this boundary, and a
 * formatter function cannot be passed from a Server Component either — hence
 * `locale` plus a direct fmtNum import rather than a callback prop.
 */
export function TrendChart({
  data,
  locale,
  onTimeLabel,
  lateLabel,
  height = 240,
}: {
  data: TrendPoint[];
  locale: Locale;
  onTimeLabel: string;
  lateLabel: string;
  height?: number;
}) {
  const fmt = (n: number) => fmtNum(n, locale);

  return (
    // dir="ltr" is the RTL fix, and it is not a [dir=rtl] override: `direction`
    // is inherited by SVG text, so under RTL `text-anchor: end` resolves against
    // the inline base direction and throws every tick label into the plot area.
    // Recharts 3.10 has no RTL support of its own (the string "rtl" does not
    // appear in its bundle). A time axis reads left-to-right in both locales
    // anyway, so resetting direction on a subtree with no layout to mirror is
    // the whole fix, in one attribute, with nothing added to globals.css.
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        // Defaults to -1, which renders nothing at all during SSR. A real
        // number emits a usable chart on the server; the ResizeObserver
        // corrects it on mount, so there is no hydration mismatch.
        initialDimension={{ width: 640, height }}
      >
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={TICK}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            width={40}
            tickLine={false}
            axisLine={false}
            tick={TICK}
            tickFormatter={fmt}
          />
          <Tooltip
            isAnimationActive={false}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: AXIS }}
            formatter={(v) => fmt(Number(v))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* isAnimationActive: v3 defaults to "auto", which replays the
              grow-from-zero animation on every server re-render — and these
              re-render whenever a filter changes, where it reads as a glitch. */}
          <Line
            type="monotone"
            dataKey="onTime"
            name={onTimeLabel}
            stroke={SERIES}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="late"
            name={lateLabel}
            stroke={LATE}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
