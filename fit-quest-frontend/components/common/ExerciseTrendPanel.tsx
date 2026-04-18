import { Text, View } from 'react-native';

import type { ExerciseAnalytics } from '@/services/analytics/types';

type ExerciseTrendPanelProps = {
  analytics: ExerciseAnalytics | null;
  isLoading: boolean;
  error?: string | null;
};

function formatDate(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) {
    return day;
  }

  return parsed.toISOString().slice(5, 10);
}

function formatKg(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }

  return `${value.toFixed(1)} kg`;
}

function toPercent(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) {
    return 0;
  }

  return Math.max(8, Math.min(100, (value / maxValue) * 100));
}

export function ExerciseTrendPanel({ analytics, isLoading, error }: ExerciseTrendPanelProps) {
  if (isLoading) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Trends</Text>
        <Text className="mt-2 text-sm text-neutral-300">Loading trends...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-red-300">Trends</Text>
        <Text className="mt-2 text-sm text-red-200">Unable to load trends: {error}</Text>
      </View>
    );
  }

  if (!analytics || analytics.totals.sessions === 0) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Trends</Text>
        <Text className="mt-2 text-sm text-neutral-300">
          No trend data yet. Log workouts for this exercise to see progression.
        </Text>
      </View>
    );
  }

  const recent = analytics.trends.recentSessionVolumesKg.slice(0, 8);
  const ascendingRecent = recent.slice().reverse();
  const maxVolume = ascendingRecent.reduce((max, point) => Math.max(max, point.volumeKg), 0);

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Trends</Text>

      <View className="mt-3 rounded-xl border border-white/10 bg-[#17171A] p-3">
        <Text className="text-[11px] uppercase tracking-[1px] text-neutral-400">30-Day Frequency</Text>
        <Text className="mt-1 text-base font-bold text-white">
          {analytics.trends.sessionsLast30Days} sessions
        </Text>
      </View>

      <View className="mt-3 rounded-xl border border-white/10 bg-[#17171A] p-3">
        <Text className="text-[11px] uppercase tracking-[1px] text-neutral-400">Last 8 Sessions Volume</Text>

        {ascendingRecent.length === 0 ? (
          <Text className="mt-2 text-sm text-neutral-300">No recent session volume data.</Text>
        ) : (
          <View className="mt-2 gap-2">
            {ascendingRecent.map((point) => (
              <View key={`${point.date}-${point.volumeKg}`}>
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-xs text-neutral-300">{formatDate(point.date)}</Text>
                  <Text className="text-xs font-semibold text-white">{formatKg(point.volumeKg)}</Text>
                </View>
                <View className="h-2 rounded-full bg-[#2A2A30]">
                  <View
                    className="h-2 rounded-full bg-[#6F31F5]"
                    style={{ width: `${toPercent(point.volumeKg, maxVolume)}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
