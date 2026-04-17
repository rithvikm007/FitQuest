const KG_PER_LB = 0.45359237;

const isPresent = (value) => value !== undefined && value !== null;

const normalizeUnit = (unit) => {
    if (typeof unit !== 'string') {
        return 'kg';
    }

    return unit.toLowerCase() === 'lb' ? 'lb' : 'kg';
};

const normalizeMetricBlock = (metric = {}) => {
    if (!isPresent(metric.weight)) {
        return {
            ...metric,
            weightUnit: isPresent(metric.weightUnit) ? normalizeUnit(metric.weightUnit) : metric.weightUnit,
            weightKg: undefined
        };
    }

    const numericWeight = Number(metric.weight);
    if (!Number.isFinite(numericWeight)) {
        return metric;
    }

    const weightUnit = normalizeUnit(metric.weightUnit);
    const weightKg = weightUnit === 'lb' ? numericWeight * KG_PER_LB : numericWeight;

    return {
        ...metric,
        weight: numericWeight,
        weightUnit,
        weightKg
    };
};

const normalizeSet = (set = {}) => {
    const normalizedSet = normalizeMetricBlock(set);
    const normalizedSegments = Array.isArray(set.segments)
        ? set.segments.map((segment) => normalizeMetricBlock(segment))
        : undefined;

    return {
        ...normalizedSet,
        segments: normalizedSegments
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