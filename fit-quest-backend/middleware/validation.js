// Input validation middleware

const VALID_WEIGHT_UNITS = ['kg', 'lb'];

const validateSetMetricObject = (setLike, errors, label) => {
  if (!setLike || typeof setLike !== 'object') {
    errors.push(`${label} is invalid`);
    return;
  }

  const hasWeight = setLike.weight !== undefined && setLike.weight !== null;
  const hasWeightUnit = setLike.weightUnit !== undefined && setLike.weightUnit !== null;
  const hasWeightKg = setLike.weightKg !== undefined && setLike.weightKg !== null;

  if (hasWeight) {
    if (typeof setLike.weight !== 'number' || !Number.isFinite(setLike.weight) || setLike.weight < 0) {
      errors.push(`${label} has invalid weight`);
    }
  }

  if (hasWeightUnit) {
    if (typeof setLike.weightUnit !== 'string' || !VALID_WEIGHT_UNITS.includes(setLike.weightUnit.toLowerCase())) {
      errors.push(`${label} has invalid weightUnit; allowed: kg, lb`);
    }
  }

  if (!hasWeight && hasWeightUnit) {
    errors.push(`${label} cannot include weightUnit without weight`);
  }

  if (hasWeightKg) {
    if (typeof setLike.weightKg !== 'number' || !Number.isFinite(setLike.weightKg) || setLike.weightKg < 0) {
      errors.push(`${label} has invalid weightKg`);
    }
  }
};

const validateExerciseSets = (exercises, errors, contextLabel) => {
  exercises.forEach((ex, index) => {
    if (!ex.exercise) {
      errors.push(`${contextLabel} at index ${index} must have an exercise ID`);
    }

    if (!ex.sets || !Array.isArray(ex.sets) || ex.sets.length === 0) {
      errors.push(`${contextLabel} at index ${index} must have at least one set`);
      return;
    }

    ex.sets.forEach((set, setIndex) => {
      if (!set || typeof set !== 'object') {
        errors.push(`${contextLabel} at index ${index} has an invalid set at index ${setIndex}`);
        return;
      }

      validateSetMetricObject(
        set,
        errors,
        `${contextLabel} at index ${index} set ${setIndex}`
      );

      if (set.segments !== undefined) {
        if (!Array.isArray(set.segments) || set.segments.length === 0) {
          errors.push(`${contextLabel} at index ${index} set ${setIndex} has invalid segments`);
          return;
        }

        set.segments.forEach((segment, segmentIndex) => {
          validateSetMetricObject(
            segment,
            errors,
            `${contextLabel} at index ${index} set ${setIndex} segment ${segmentIndex}`
          );
        });
      }
    });
  });
};

const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  // Validate username
  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
  } else if (username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (username.trim().length > 30) {
    errors.push('Username cannot exceed 30 characters');
  }

  // Validate email
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address');
  }

  // Validate password
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

const validateWorkout = (req, res, next) => {
  const { exercises, date } = req.body;
  const errors = [];

  // Exercises array is required and must not be empty
  if (!exercises || !Array.isArray(exercises)) {
    errors.push('Exercises array is required');
  } else if (exercises.length === 0) {
    errors.push('At least one exercise is required');
  } else {
    validateExerciseSets(exercises, errors, 'Exercise');
  }

  // Validate date if provided
  if (date && isNaN(Date.parse(date))) {
    errors.push('Invalid date format');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

const validatePlan = (req, res, next) => {
  const { name, exercises } = req.body;
  const errors = [];

  // Name is required
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Plan name is required');
  }

  // Exercises array is required and must not be empty
  if (!exercises || !Array.isArray(exercises)) {
    errors.push('Exercises array is required');
  } else if (exercises.length === 0) {
    errors.push('At least one exercise is required');
  } else {
    validateExerciseSets(exercises, errors, 'Exercise');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

const validateExercise = (req, res, next) => {
  const { name, category, primaryMuscle, type, equipment, instructions } = req.body;
  const errors = [];

  // Name is required
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Exercise name is required');
  }

  // Category validation
  const validCategories = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full body'];
  if (!category || !validCategories.includes(category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`);
  }

  // Primary muscle validation
  const validMuscles = ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'cardio', 'chest', 'forearms', 'full body', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'obliques', 'core', 'shoulders', 'traps', 'triceps', 'upper back', 'other'];
  if (!primaryMuscle || !validMuscles.includes(primaryMuscle)) {
    errors.push(`Primary muscle must be one of: ${validMuscles.join(', ')}`);
  }

  // Type validation
  const validTypes = ['weight and reps', 'bodyweight reps', 'weighted bodyweight', 'assisted bodyweight', 'duration', 'duration and weight', 'distance and duration', 'weight and distance'];
  if (!type || !validTypes.includes(type)) {
    errors.push(`Type must be one of: ${validTypes.join(', ')}`);
  }

  // Equipment validation
  const validEquipment = ['band', 'cable', 'dumbbell', 'barbell', 'body weight', 'kettlebell', 'machine', 'medicine ball', 'olympic barbell', 'resistance band', 'rope', 'sled', 'smith machine', 'stability ball', 'step', 'tire', 'weight plate', 'other'];
  if (!equipment || !validEquipment.includes(equipment)) {
    errors.push(`Equipment must be one of: ${validEquipment.join(', ')}`);
  }

  // Instructions validation
  if (!instructions || !Array.isArray(instructions) || instructions.length === 0) {
    errors.push('At least one instruction is required');
  } else {
    instructions.forEach((instruction, index) => {
      if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
        errors.push(`Instruction at index ${index} cannot be empty`);
      } else if (instruction.length > 200) {
        errors.push(`Instruction at index ${index} must be 200 characters or less`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

const validateProfile = (req, res, next) => {
  const { profile } = req.body;
  const errors = [];

  if (!profile || typeof profile !== 'object') {
    errors.push('Profile object is required');
  } else {
    // Validate age if provided
    if (profile.age !== undefined && profile.age !== null) {
      if (typeof profile.age !== 'number' || profile.age < 1 || profile.age > 150) {
        errors.push('Age must be a number between 1 and 150');
      }
    }

    // Validate height if provided
    if (profile.height !== undefined && profile.height !== null) {
      if (typeof profile.height !== 'number' || profile.height < 50 || profile.height > 300) {
        errors.push('Height must be a number between 50 and 300 cm');
      }
    }

    // Validate weight if provided
    if (profile.weight !== undefined && profile.weight !== null) {
      if (typeof profile.weight !== 'number' || profile.weight < 20 || profile.weight > 500) {
        errors.push('Weight must be a number between 20 and 500 kg');
      }
    }

    // Validate firstName if provided
    if (profile.firstName !== undefined && profile.firstName !== null) {
      if (typeof profile.firstName !== 'string' || profile.firstName.length > 50) {
        errors.push('First name must be a string with max 50 characters');
      }
    }

    // Validate lastName if provided
    if (profile.lastName !== undefined && profile.lastName !== null) {
      if (typeof profile.lastName !== 'string' || profile.lastName.length > 50) {
        errors.push('Last name must be a string with max 50 characters');
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateWorkout,
  validatePlan,
  validateExercise,
  validateProfile
};
