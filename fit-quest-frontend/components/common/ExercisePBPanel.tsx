import { Text, View } from 'react-native';

import type { ExerciseAnalytics } from '@/services/analytics/types';

type ExercisePBPanelProps = {
  analytics: ExerciseAnalytics | null;
  isLoading: boolean;
  error?: string | null;
};

function formatDate(dateIso: string | null | undefined): string {
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

function formatKgReps(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }

  return `${value.toFixed(1)} kg*reps`;
}

function formatEntrySource(setIndex: number, segmentIndex: number | null): string {
  const setLabel = `Set ${setIndex + 1}`;
  if (segmentIndex === null) {
    return `${setLabel}, top-level`;
  }

  return `${setLabel}, entry ${segmentIndex + 1}`;
}

type PbItemProps = {
  title: string;
  value: string;
  subtitle?: string;
  sourceLine?: string;
};

function PbItem({ title, value, subtitle, sourceLine }: PbItemProps) {
  return (
    <View className="rounded-xl border border-white/10 bg-[#17171A] p-3">
      <Text className="text-[11px] uppercase tracking-[1px] text-neutral-400">{title}</Text>
      <Text className="mt-1 text-base font-bold text-white">{value}</Text>
      {subtitle ? <Text className="mt-1 text-xs text-neutral-300">{subtitle}</Text> : null}
      {sourceLine ? <Text className="mt-1 text-xs text-[#DBB8FF]">{sourceLine}</Text> : null}
    </View>
  );
}

export function ExercisePBPanel({ analytics, isLoading, error }: ExercisePBPanelProps) {
  if (isLoading) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Personal Bests</Text>
        <Text className="mt-2 text-sm text-neutral-300">Loading personal bests...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-red-300">Personal Bests</Text>
        <Text className="mt-2 text-sm text-red-200">Unable to load PBs: {error}</Text>
      </View>
    );
  }

  if (!analytics || analytics.totals.sessions === 0) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Personal Bests</Text>
        <Text className="mt-2 text-sm text-neutral-300">No personal bests yet. Log workouts for this exercise to establish PBs.</Text>
      </View>
    );
  }

  const maxWeight = analytics.personalBests.maxWeight;
  const maxSetVolume = analytics.personalBests.maxSetVolume;
  const maxWorkoutVolume = analytics.personalBests.maxWorkoutVolume;
  const bestEstimatedOneRepMax = analytics.personalBests.bestEstimated1RM;

  const repsAtWeightEntries = Object.entries(analytics.personalBests.maxRepsAtWeight)
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .slice(0, 3);

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Personal Bests</Text>

      <View className="mt-3 gap-2">
        <PbItem
          title="Max Weight"
          value={formatKg(maxWeight?.valueKg)}
          subtitle={maxWeight ? `Supporting reps: ${maxWeight.supportingReps ?? '-'}` : undefined}
          sourceLine={
            maxWeight
              ? `${formatDate(maxWeight.source.workoutDate)} • ${formatEntrySource(maxWeight.source.setIndex, maxWeight.source.segmentIndex)}`
              : undefined
          }
        />

        <PbItem
          title="Max Set Volume"
          value={formatKgReps(maxSetVolume?.valueKgReps)}
          sourceLine={
            maxSetVolume
              ? `${formatDate(maxSetVolume.source.workoutDate)} • ${formatEntrySource(maxSetVolume.source.setIndex, maxSetVolume.source.segmentIndex)}`
              : undefined
          }
        />

        <PbItem
          title="Max Workout Volume"
          value={formatKgReps(maxWorkoutVolume?.valueKgReps)}
          sourceLine={
            maxWorkoutVolume
              ? `${formatDate(maxWorkoutVolume.sourceWorkoutDate)} • Workout ${maxWorkoutVolume.sourceWorkoutId}`
              : undefined
          }
        />

        <PbItem
          title="Best Estimated 1RM"
          value={formatKg(bestEstimatedOneRepMax?.valueKg)}
          subtitle={
            bestEstimatedOneRepMax
              ? `Lift: ${bestEstimatedOneRepMax.liftedWeightKg.toFixed(1)} kg x ${bestEstimatedOneRepMax.reps}`
              : undefined
          }
          sourceLine={
            bestEstimatedOneRepMax
              ? `${formatDate(bestEstimatedOneRepMax.source.workoutDate)} • ${formatEntrySource(bestEstimatedOneRepMax.source.setIndex, bestEstimatedOneRepMax.source.segmentIndex)}`
              : undefined
          }
        />

        <View className="rounded-xl border border-white/10 bg-[#17171A] p-3">
          <Text className="text-[11px] uppercase tracking-[1px] text-neutral-400">Best Reps At Weight</Text>
          {repsAtWeightEntries.length === 0 ? (
            <Text className="mt-1 text-sm text-neutral-300">No rep-at-weight PBs yet.</Text>
          ) : (
            <View className="mt-2 gap-2">
              {repsAtWeightEntries.map(([weightKey, record]) => (
                <View key={weightKey} className="rounded-lg border border-white/10 bg-[#202024] p-2">
                  <Text className="text-sm font-semibold text-white">
                    {record.reps} reps @ {formatKg(record.weightKg)}
                  </Text>
                  <Text className="mt-1 text-xs text-[#DBB8FF]">
                    {formatDate(record.source.workoutDate)} • {formatEntrySource(record.source.setIndex, record.source.segmentIndex)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
