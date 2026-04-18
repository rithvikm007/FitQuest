import { Text, View } from 'react-native';

import type { ExerciseAnalytics } from '@/services/analytics/types';

type ExerciseAnalyticsSummaryProps = {
  analytics: ExerciseAnalytics | null;
  isLoading: boolean;
  error?: string | null;
};

function formatDate(dateIso: string | null): string {
  if (!dateIso) {
    return '-';
  }

  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  return parsed.toISOString().slice(0, 10);
}

function formatKg(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }

  return `${value.toFixed(1)} kg`;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '0';
  }

  return String(Math.floor(value));
}

type StatItemProps = {
  label: string;
  value: string;
};

function StatItem({ label, value }: StatItemProps) {
  return (
    <View className="rounded-xl border border-white/10 bg-[#17171A] p-3">
      <Text className="text-[11px] uppercase tracking-[1px] text-neutral-400">{label}</Text>
      <Text className="mt-1 text-base font-bold text-white">{value}</Text>
    </View>
  );
}

export function ExerciseAnalyticsSummary({ analytics, isLoading, error }: ExerciseAnalyticsSummaryProps) {
  if (isLoading) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Analytics Summary
        </Text>
        <Text className="mt-2 text-sm text-neutral-300">Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-red-300">
          Analytics Summary
        </Text>
        <Text className="mt-2 text-sm text-red-200">Unable to load analytics: {error}</Text>
      </View>
    );
  }

  if (!analytics || analytics.totals.sessions === 0) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Analytics Summary
        </Text>
        <Text className="mt-2 text-sm text-neutral-300">
          No workout history yet for this exercise. Complete a workout to see progress metrics.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Analytics Summary
      </Text>

      <View className="mt-3 gap-2">
        <StatItem label="Last Performed" value={formatDate(analytics.context.lastPerformedDate)} />
        <StatItem label="Lifetime Volume" value={formatKg(analytics.totals.volumeKg)} />
        <StatItem label="Max Weight" value={formatKg(analytics.personalBests.maxWeight?.valueKg ?? null)} />
        <StatItem
          label="Max Workout Volume"
          value={formatKg(analytics.personalBests.maxWorkoutVolume?.valueKgReps ?? null)}
        />
        <StatItem label="Session Count" value={formatCount(analytics.totals.sessions)} />
      </View>
    </View>
  );
}
