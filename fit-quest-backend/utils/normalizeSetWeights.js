const KG_PER_LB = 0.45359237;

const isPresent = (value) => value !== undefined && value !== null;

const normalizeUnit = (unit) => {
    if (typeof unit !== 'string') {
        return 'kg';
    }

    return unit.toLowerCase() === 'lb' ? 'lb' : 'kg';
};

const normalizeSet = (set = {}) => {
    if (!isPresent(set.weight)) {
        return {
            ...set,
            weightUnit: isPresent(set.weightUnit) ? normalizeUnit(set.weightUnit) : set.weightUnit,
            weightKg: undefined
        };
    }

    const numericWeight = Number(set.weight);
    if (!Number.isFinite(numericWeight)) {
        return set;
    }

    const weightUnit = normalizeUnit(set.weightUnit);
    const weightKg = weightUnit === 'lb' ? numericWeight * KG_PER_LB : numericWeight;

    return {
        ...set,
        weight: numericWeight,
        weightUnit,
        weightKg
    };
};

const normalizeExerciseSets = (exercises = []) => {
    if (!Array.isArray(exercises)) {
        return exercises;
    }

    return exercises.map((exerciseEntry = {}) => ({
        ...exerciseEntry,
        sets: Array.isArray(exerciseEntry.sets) ? exerciseEntry.sets.map(normalizeSet) : exerciseEntry.sets
    }));
};

module.exports = {
    KG_PER_LB,
    normalizeExerciseSets
};