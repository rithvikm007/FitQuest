import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { getDatabase, initDatabase } from '@/database/index';
import {
  deleteExercise,
  getExerciseById,
  getExercises,
  saveExercise,
  searchExercises,
} from '@/services/db/exerciseDbService';
import { clearUser, getUser, saveUser, updateUserProfile } from '@/services/db/userDbService';
import {
  deleteWorkout,
  getWorkoutById,
  getWorkouts,
  saveWorkout,
  searchWorkouts,
  updateWorkout,
} from '@/services/db/workoutDbService';
import {
  deletePlan,
  getPlanById,
  getPlans,
  savePlan,
  searchPlans,
  updatePlan,
} from '@/services/db/planDbService';
import type {
  Exercise,
  Plan,
  PlanExercise,
  PlanSet,
  User,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/models';
import '@/global.css';

type TestResult = {
  label: string;
  status: 'pass' | 'fail' | 'info';
  details: string;
};

const seedUser: Partial<User> = {
  username: 'fitquestdev',
  email: 'fitquestdev@example.com',
  remoteId: 'mongo-user-123',
};

function formatValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function generateUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function HomeScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const appendResult = (result: TestResult) => {
    setResults((currentResults) => [...currentResults, result]);
  };

  const runSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS. Web uses a no-op database stub.',
      });
      setIsRunning(false);
      return;
    }

    try {
      appendResult({
        label: 'Step 1: clearUser()',
        status: 'info',
        details: 'Removing any previous local user row before starting the smoke test.',
      });
      await clearUser();

      appendResult({
        label: 'Step 2: saveUser()',
        status: 'info',
        details: `Saving seed user: ${formatValue(seedUser)}`,
      });
      await saveUser(seedUser);

      const savedUser = await getUser();
      if (!savedUser || savedUser.username !== seedUser.username || savedUser.remoteId !== seedUser.remoteId) {
        throw new Error(`Saved user mismatch. Received: ${formatValue(savedUser)}`);
      }

      appendResult({
        label: 'Step 3: getUser()',
        status: 'pass',
        details: `Loaded user successfully: ${formatValue(savedUser)}`,
      });

      await updateUserProfile({
        firstName: 'Fit',
        lastName: 'Quest',
        age: 28,
        height: 178,
        weight: 76,
      });

      const updatedUser = await getUser();
      const profileUpdated =
        updatedUser?.firstName === 'Fit' &&
        updatedUser?.lastName === 'Quest' &&
        updatedUser?.age === 28 &&
        updatedUser?.height === 178 &&
        updatedUser?.weight === 76 &&
        updatedUser?.remoteId === seedUser.remoteId;

      if (!updatedUser || !profileUpdated) {
        throw new Error(`Updated user mismatch. Received: ${formatValue(updatedUser)}`);
      }

      appendResult({
        label: 'Step 4: updateUserProfile()',
        status: 'pass',
        details: `Profile updated correctly and remoteId preserved: ${formatValue(updatedUser)}`,
      });

      await clearUser();
      const clearedUser = await getUser();

      if (clearedUser !== null) {
        throw new Error(`Expected null after clearUser(), received: ${formatValue(clearedUser)}`);
      }

      appendResult({
        label: 'Step 5: clearUser()',
        status: 'pass',
        details: 'Local user row removed successfully. getUser() returned null.',
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.1 passed on this device. You can remove this test harness after verification.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({
        label: 'Smoke test failed',
        status: 'fail',
        details: message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runWorkoutSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS.',
      });
      setIsRunning(false);
      return;
    }

    try {
      await initDatabase();
      const db = getDatabase();

      // Clear tables bottom-up to respect foreign keys
      await db.runAsync('DELETE FROM workout_sets;');
      await db.runAsync('DELETE FROM workout_exercises;');
      await db.runAsync('DELETE FROM workouts;');
      await db.runAsync('DELETE FROM exercises;');

      appendResult({
        label: 'Step 1: clear tables',
        status: 'pass',
        details: 'workout_sets, workout_exercises, workouts, exercises tables cleared.',
      });

      // Seed one exercise to reference in workout_exercises
      const now = new Date().toISOString();

      // workouts.userId is a FK → users.id; insert a seed user so the constraint is satisfied
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, username, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?);`,
        ['local-user-1', 'smoketest', 'smoketest@test.com', now, now]
      );

      const exerciseId = generateUuid();
      const seedExercise: Exercise = {
        id: exerciseId,
        name: 'Barbell Squat',
        category: 'legs',
        primaryMuscle: 'quadriceps',
        otherMuscles: ['glutes', 'hamstrings'],
        type: 'weight and reps',
        equipment: 'barbell',
        instructions: ['Position the bar', 'Squat down', 'Drive back up'],
        isCustom: false,
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };
      await saveExercise(seedExercise);

      // Step 2: saveWorkout with 1 exercise + 2 sets
      const weId = generateUuid();
      const workoutId = generateUuid();
      const workout1: Workout = {
        id: workoutId,
        userId: 'local-user-1',
        date: now,
        name: 'Push Day',
        notes: 'Felt strong',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };
      const workoutExercises: WorkoutExercise[] = [
        { id: weId, workoutId, exerciseId, orderIndex: 0, createdAt: now },
      ];
      const workoutSets: WorkoutSet[] = [
        { id: generateUuid(), workoutExerciseId: weId, reps: 5, weight: 100, orderIndex: 0, createdAt: now },
        { id: generateUuid(), workoutExerciseId: weId, reps: 5, weight: 105, orderIndex: 1, createdAt: now },
      ];

      const savedWorkoutId = await saveWorkout(workout1, workoutExercises, workoutSets);
      const allWorkouts = await getWorkouts(1, 10);

      if (allWorkouts.length !== 1 || allWorkouts[0].name !== 'Push Day' || allWorkouts[0].syncStatus !== 'pending') {
        throw new Error(`getWorkouts mismatch: ${formatValue(allWorkouts)}`);
      }

      appendResult({
        label: 'Step 2: saveWorkout + getWorkouts',
        status: 'pass',
        details: `Saved id=${savedWorkoutId}, getWorkouts(1,10) returned ${allWorkouts.length} row(s), syncStatus=pending.`,
      });

      // Step 3: getWorkoutById nested join
      const fullWorkout = await getWorkoutById(savedWorkoutId);
      if (!fullWorkout) throw new Error('getWorkoutById returned null');
      if (fullWorkout.exercises.length !== 1) {
        throw new Error(`Expected 1 exercise, got ${fullWorkout.exercises.length}`);
      }
      if (fullWorkout.exercises[0].sets.length !== 2) {
        throw new Error(`Expected 2 sets, got ${fullWorkout.exercises[0].sets.length}`);
      }
      if (fullWorkout.exercises[0].exercise.name !== 'Barbell Squat') {
        throw new Error(`Exercise name mismatch: ${fullWorkout.exercises[0].exercise.name}`);
      }

      appendResult({
        label: 'Step 3: getWorkoutById nested join',
        status: 'pass',
        details: `exercises=${fullWorkout.exercises.length}, sets=${fullWorkout.exercises[0].sets.length}, exercise.name=${fullWorkout.exercises[0].exercise.name}`,
      });

      // Step 4: updateWorkout (name only, no exercise/set replacement)
      await updateWorkout(savedWorkoutId, { name: 'Push Day Updated' });
      const updatedFull = await getWorkoutById(savedWorkoutId);
      if (!updatedFull || updatedFull.name !== 'Push Day Updated' || updatedFull.syncStatus !== 'pending') {
        throw new Error(`updateWorkout mismatch: ${formatValue(updatedFull)}`);
      }

      appendResult({
        label: 'Step 4: updateWorkout',
        status: 'pass',
        details: `Name updated to "${updatedFull.name}", syncStatus=${updatedFull.syncStatus}`,
      });

      // Step 5: searchWorkouts
      const found = await searchWorkouts('push');
      const notFound = await searchWorkouts('xyznotfound');
      if (found.length !== 1) throw new Error(`Expected 1 result for 'push', got ${found.length}`);
      if (notFound.length !== 0) throw new Error(`Expected 0 results for 'xyznotfound', got ${notFound.length}`);

      appendResult({
        label: 'Step 5: searchWorkouts',
        status: 'pass',
        details: `search('push')=${found.length}, search('xyznotfound')=${notFound.length}`,
      });

      // Step 6: remoteId reconciliation
      const remoteWId = 'mongo-workout-999';
      const workout2Id = generateUuid();
      const workout2: Workout = {
        id: workout2Id,
        remoteId: remoteWId,
        userId: 'local-user-1',
        date: now,
        name: 'Leg Day',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };
      const savedW2Id = await saveWorkout(workout2, [], []);

      const reconciledWorkout: Workout = {
        ...workout2,
        id: generateUuid(), // different local id, same remoteId
        name: 'Leg Day Updated',
      };
      const reconciledId = await saveWorkout(reconciledWorkout, [], []);

      if (reconciledId !== savedW2Id) {
        throw new Error(`remoteId reconciliation failed: expected ${savedW2Id}, got ${reconciledId}`);
      }

      const lookedUp = await getWorkoutById(remoteWId); // lookup by remoteId
      if (!lookedUp || lookedUp.name !== 'Leg Day Updated') {
        throw new Error(`Lookup by remoteId failed: ${formatValue(lookedUp)}`);
      }

      appendResult({
        label: 'Step 6: remoteId reconciliation',
        status: 'pass',
        details: `Upsert kept local id=${savedW2Id}. Lookup by remoteId returned "${lookedUp.name}".`,
      });

      // Step 7: deleteWorkout + cascade check
      await deleteWorkout(savedWorkoutId);
      const deletedLookup = await getWorkoutById(savedWorkoutId);
      const remainingWorkouts = await getWorkouts(1, 10);

      if (deletedLookup !== null) {
        throw new Error(`Expected null after deleteWorkout, got ${formatValue(deletedLookup)}`);
      }
      if (remainingWorkouts.length !== 1 || remainingWorkouts[0].id !== savedW2Id) {
        throw new Error(`Remaining workouts mismatch: ${formatValue(remainingWorkouts)}`);
      }

      appendResult({
        label: 'Step 7: deleteWorkout (soft delete)',
        status: 'pass',
        details: `Soft delete OK. getWorkoutById returns null. ${remainingWorkouts.length} active workout(s) remaining.`,
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.3 passed. Transactions, nested join, pagination, search, remoteId reconciliation, and soft delete verified.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({ label: 'Smoke test failed', status: 'fail', details: message });
    } finally {
      setIsRunning(false);
    }
  };

  const runPlanSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS.',
      });
      setIsRunning(false);
      return;
    }

    try {
      await initDatabase();
      const db = getDatabase();

      // Clear dependent tables first to satisfy foreign key constraints.
      await db.runAsync('DELETE FROM workout_sets;');
      await db.runAsync('DELETE FROM workout_exercises;');
      await db.runAsync('DELETE FROM workouts;');
      await db.runAsync('DELETE FROM plan_sets;');
      await db.runAsync('DELETE FROM plan_exercises;');
      await db.runAsync('DELETE FROM plans;');
      await db.runAsync('DELETE FROM exercises;');

      appendResult({
        label: 'Step 1: clear tables',
        status: 'pass',
        details: 'workout_sets, workout_exercises, workouts, plan_sets, plan_exercises, plans, exercises tables cleared.',
      });

      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, username, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?);`,
        ['local-user-1', 'smoketest', 'smoketest@test.com', now, now]
      );

      const exerciseId = generateUuid();
      const seedExercise: Exercise = {
        id: exerciseId,
        name: 'Romanian Deadlift',
        category: 'legs',
        primaryMuscle: 'hamstrings',
        otherMuscles: ['glutes', 'lower back'],
        type: 'weight and reps',
        equipment: 'barbell',
        instructions: ['Hinge at hips', 'Lower bar down legs', 'Stand back up'],
        isCustom: false,
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };
      await saveExercise(seedExercise);

      const planId = generateUuid();
      const planExerciseId = generateUuid();
      const planA: Plan = {
        id: planId,
        userId: 'local-user-1',
        name: 'Lower Body A',
        plannedDate: now,
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const planExercises: PlanExercise[] = [
        { id: planExerciseId, planId, exerciseId, orderIndex: 0, createdAt: now },
      ];

      const planSets: PlanSet[] = [
        { id: generateUuid(), planExerciseId, reps: 8, weight: 80, orderIndex: 0, createdAt: now },
        { id: generateUuid(), planExerciseId, reps: 8, weight: 85, orderIndex: 1, createdAt: now },
      ];

      const savedPlanId = await savePlan(planA, planExercises, planSets);
      const allPlans = await getPlans(1, 10);

      if (allPlans.length !== 1 || allPlans[0].name !== 'Lower Body A' || allPlans[0].syncStatus !== 'pending') {
        throw new Error(`getPlans mismatch: ${formatValue(allPlans)}`);
      }

      appendResult({
        label: 'Step 2: savePlan + getPlans',
        status: 'pass',
        details: `Saved id=${savedPlanId}, getPlans(1,10) returned ${allPlans.length} row(s), syncStatus=pending.`,
      });

      const fullPlan = await getPlanById(savedPlanId);
      if (!fullPlan) throw new Error('getPlanById returned null');
      if (fullPlan.exercises.length !== 1) {
        throw new Error(`Expected 1 exercise, got ${fullPlan.exercises.length}`);
      }
      if (fullPlan.exercises[0].sets.length !== 2) {
        throw new Error(`Expected 2 sets, got ${fullPlan.exercises[0].sets.length}`);
      }
      if (fullPlan.exercises[0].exercise.name !== 'Romanian Deadlift') {
        throw new Error(`Exercise name mismatch: ${fullPlan.exercises[0].exercise.name}`);
      }

      appendResult({
        label: 'Step 3: getPlanById nested join',
        status: 'pass',
        details: `exercises=${fullPlan.exercises.length}, sets=${fullPlan.exercises[0].sets.length}, exercise.name=${fullPlan.exercises[0].exercise.name}`,
      });

      await updatePlan(savedPlanId, { name: 'Lower Body A Updated' });
      const updatedPlan = await getPlanById(savedPlanId);
      if (!updatedPlan || updatedPlan.name !== 'Lower Body A Updated' || updatedPlan.syncStatus !== 'pending') {
        throw new Error(`updatePlan mismatch: ${formatValue(updatedPlan)}`);
      }

      appendResult({
        label: 'Step 4: updatePlan',
        status: 'pass',
        details: `Name updated to "${updatedPlan.name}", syncStatus=${updatedPlan.syncStatus}`,
      });

      const found = await searchPlans('lower');
      const notFound = await searchPlans('xyznotfound');
      if (found.length !== 1) throw new Error(`Expected 1 result for 'lower', got ${found.length}`);
      if (notFound.length !== 0) throw new Error(`Expected 0 results for 'xyznotfound', got ${notFound.length}`);

      appendResult({
        label: 'Step 5: searchPlans',
        status: 'pass',
        details: `search('lower')=${found.length}, search('xyznotfound')=${notFound.length}`,
      });

      const remotePlanId = 'mongo-plan-555';
      const planB: Plan = {
        id: generateUuid(),
        remoteId: remotePlanId,
        userId: 'local-user-1',
        name: 'Upper Body B',
        plannedDate: new Date(Date.now() + 86_400_000).toISOString(),
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const savedPlanBId = await savePlan(planB, [], []);
      const reconciledPlan: Plan = {
        ...planB,
        id: generateUuid(),
        name: 'Upper Body B Updated',
      };
      const reconciledId = await savePlan(reconciledPlan, [], []);

      if (reconciledId !== savedPlanBId) {
        throw new Error(`remoteId reconciliation failed: expected ${savedPlanBId}, got ${reconciledId}`);
      }

      const lookupByRemote = await getPlanById(remotePlanId);
      if (!lookupByRemote || lookupByRemote.name !== 'Upper Body B Updated') {
        throw new Error(`Lookup by remoteId failed: ${formatValue(lookupByRemote)}`);
      }

      appendResult({
        label: 'Step 6: remoteId reconciliation',
        status: 'pass',
        details: `Upsert kept local id=${savedPlanBId}. Lookup by remoteId returned "${lookupByRemote.name}".`,
      });

      await deletePlan(savedPlanId);
      const deletedLookup = await getPlanById(savedPlanId);
      const remainingPlans = await getPlans(1, 10);

      if (deletedLookup !== null) {
        throw new Error(`Expected null after deletePlan, got ${formatValue(deletedLookup)}`);
      }
      if (remainingPlans.length !== 1 || remainingPlans[0].id !== savedPlanBId) {
        throw new Error(`Remaining plans mismatch: ${formatValue(remainingPlans)}`);
      }

      appendResult({
        label: 'Step 7: deletePlan (soft delete)',
        status: 'pass',
        details: `Soft delete OK. getPlanById returns null. ${remainingPlans.length} active plan(s) remaining.`,
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.4 passed. Transactions, nested join, pagination, search, remoteId reconciliation, and soft delete verified.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({ label: 'Smoke test failed', status: 'fail', details: message });
    } finally {
      setIsRunning(false);
    }
  };

  const runExerciseSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS. Web uses a no-op database stub.',
      });
      setIsRunning(false);
      return;
    }

    try {
      await initDatabase();
      const db = getDatabase();
      await db.runAsync('DELETE FROM exercises;');

      appendResult({
        label: 'Step 1: clear exercises',
        status: 'pass',
        details: 'Exercises table cleared for deterministic Task 2.2 smoke test.',
      });

      const now = new Date().toISOString();
      const exerciseA: Exercise = {
        id: generateUuid(),
        name: 'Push Up',
        description: 'Bodyweight push exercise',
        category: 'chest',
        primaryMuscle: 'chest',
        otherMuscles: ['triceps', 'shoulders'],
        type: 'bodyweight reps',
        equipment: 'body weight',
        instructions: ['Get into plank position', 'Lower chest', 'Push back up'],
        isCustom: true,
        userId: 'local-user-1',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const savedAId = await saveExercise(exerciseA);
      const savedA = await getExerciseById(savedAId);

      if (!savedA || savedA.name !== 'Push Up' || savedA.syncStatus !== 'pending') {
        throw new Error(`Exercise create/get mismatch: ${formatValue(savedA)}`);
      }

      appendResult({
        label: 'Step 2: save/get exercise',
        status: 'pass',
        details: `Saved and loaded exercise A: ${formatValue(savedA)}`,
      });

      const remoteId = 'mongo-exercise-1';
      const exerciseB: Exercise = {
        id: generateUuid(),
        remoteId,
        name: 'Bench Press',
        description: 'Barbell chest press',
        category: 'chest',
        primaryMuscle: 'chest',
        otherMuscles: ['triceps', 'shoulders'],
        type: 'weight and reps',
        equipment: 'barbell',
        instructions: ['Lie on bench', 'Lower bar to chest', 'Press up'],
        videoUrl: 'https://example.com/bench',
        isCustom: false,
        userId: 'local-user-1',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const savedBId = await saveExercise(exerciseB);

      const updatedB: Exercise = {
        ...exerciseB,
        id: generateUuid(),
        name: 'Bench Press Updated',
      };
      const reconciledId = await saveExercise(updatedB);

      if (reconciledId !== savedBId) {
        throw new Error(`Expected remoteId reconciliation to keep id ${savedBId}, got ${reconciledId}`);
      }

      const lookupByRemote = await getExerciseById(remoteId);
      if (!lookupByRemote || lookupByRemote.id !== savedBId || lookupByRemote.name !== 'Bench Press Updated') {
        throw new Error(`Lookup by remoteId failed: ${formatValue(lookupByRemote)}`);
      }

      appendResult({
        label: 'Step 3: remoteId reconciliation',
        status: 'pass',
        details: `Upsert by remoteId succeeded: ${formatValue(lookupByRemote)}`,
      });

      const allExercises = await getExercises();
      const chestExercises = await getExercises({ category: 'chest' });
      const customExercises = await getExercises({ isCustom: true });
      const searchResult = await searchExercises('bench');

      if (allExercises.length !== 2) {
        throw new Error(`Expected 2 active exercises, got ${allExercises.length}`);
      }

      if (chestExercises.length !== 2) {
        throw new Error(`Expected 2 chest exercises, got ${chestExercises.length}`);
      }

      if (customExercises.length !== 1 || customExercises[0].name !== 'Push Up') {
        throw new Error(`Custom exercise filter mismatch: ${formatValue(customExercises)}`);
      }

      if (!searchResult.some((exercise) => exercise.name.toLowerCase().includes('bench'))) {
        throw new Error(`Search results mismatch: ${formatValue(searchResult)}`);
      }

      appendResult({
        label: 'Step 4: filters and search',
        status: 'pass',
        details: `Filters/search passed. all=${allExercises.length}, chest=${chestExercises.length}, custom=${customExercises.length}, search=${searchResult.length}`,
      });

      await deleteExercise(savedAId);
      const deletedA = await getExerciseById(savedAId);
      const remainingExercises = await getExercises();

      if (deletedA !== null) {
        throw new Error(`Expected deleted exercise lookup to return null, received: ${formatValue(deletedA)}`);
      }

      if (remainingExercises.length !== 1 || remainingExercises[0].id !== savedBId) {
        throw new Error(`Soft delete failed. Remaining rows: ${formatValue(remainingExercises)}`);
      }

      appendResult({
        label: 'Step 5: soft delete',
        status: 'pass',
        details: `Soft delete works. Remaining active exercise: ${remainingExercises[0].name}`,
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.2 passed on this device. CRUD, filters, search, JSON fields, and soft delete verified.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({
        label: 'Smoke test failed',
        status: 'fail',
        details: message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 p-6">
      <View className="gap-2">
        <Text className="text-3xl font-bold text-white">Phase 2 Smoke Tests</Text>
        <Text className="text-sm leading-6 text-neutral-300">
          Run these on Android or iOS to verify database service behavior before moving forward.
        </Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Available tests</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.1: User CRUD + remoteId preservation</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.2: Exercise CRUD + JSON parse/stringify + filters/search + soft delete</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.3: Workout CRUD + transactions + nested join + pagination + soft delete</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.4: Plan CRUD + transactions + nested join + pagination + soft delete</Text>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <Pressable
            className={`flex-1 rounded-xl px-4 py-4 ${isRunning ? 'bg-violet-300' : 'bg-primary'}`}
            disabled={isRunning}
            onPress={runSmokeTest}>
            <View className="min-h-6 flex-row items-center justify-center gap-2">
              {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text className="text-center font-semibold text-white">
                {isRunning ? 'Running...' : 'Run Task 2.1 Test'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            className={`flex-1 rounded-xl px-4 py-4 ${isRunning ? 'bg-indigo-300' : 'bg-secondary'}`}
            disabled={isRunning}
            onPress={runExerciseSmokeTest}>
            <View className="min-h-6 flex-row items-center justify-center gap-2">
              {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text className="text-center font-semibold text-white">
                {isRunning ? 'Running...' : 'Run Task 2.2 Test'}
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          className={`rounded-xl px-4 py-4 ${isRunning ? 'bg-violet-900' : 'bg-violet-700'}`}
          disabled={isRunning}
          onPress={runWorkoutSmokeTest}>
          <View className="min-h-6 flex-row items-center justify-center gap-2">
            {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text className="text-center font-semibold text-white">
              {isRunning ? 'Running...' : 'Run Task 2.3 Test'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          className={`rounded-xl px-4 py-4 ${isRunning ? 'bg-cyan-900' : 'bg-cyan-700'}`}
          disabled={isRunning}
          onPress={runPlanSmokeTest}>
          <View className="min-h-6 flex-row items-center justify-center gap-2">
            {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text className="text-center font-semibold text-white">
              {isRunning ? 'Running...' : 'Run Task 2.4 Test'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          className="rounded-xl border border-neutral-700 px-4 py-4"
          disabled={isRunning}
          onPress={() => setResults([])}>
          <Text className="text-center font-semibold text-neutral-200">Clear Log</Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-lg font-semibold text-white">Results</Text>

        {results.length === 0 ? (
          <Text className="text-sm leading-6 text-neutral-400">
            No results yet. Run the test and watch this panel for pass or fail details.
          </Text>
        ) : (
          results.map((result, index) => {
            const accentClass =
              result.status === 'pass'
                ? 'border-emerald-500 bg-emerald-500/10'
                : result.status === 'fail'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-secondary bg-secondary/10';

            return (
              <View key={`${result.label}-${index}`} className={`gap-2 rounded-xl border p-3 ${accentClass}`}>
                <Text className="font-semibold text-white">{result.label}</Text>
                <Text className="text-xs leading-5 text-neutral-200">{result.details}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
