const Exercise = require('../models/Exercise');
const asyncHandler = require('express-async-handler');

// @desc    Create a new exercise
// @route   POST /api/exercises
// @access  Private
const createExercise = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        category,
        primaryMuscle,
        otherMuscles,
        type,
        equipment,
        instructions,
        videoUrl
    } = req.body;

    // Custom exercises must be tied to a user
    const exercise = await Exercise.create({
        name,
        description,
        category,
        primaryMuscle,
        otherMuscles,
        type,
        equipment,
        instructions,
        videoUrl,
        isCustom: false,
        user: req.user._id
    });

    res.status(201).json(exercise);
});

// @desc    Get all exercises with filters
// @route   GET /api/exercises
// @access  Public
const getExercises = asyncHandler(async (req, res) => {
    const {
        category,
        type,
        equipment,
        primaryMuscle,
        isCustom
    } = req.query;

    const filter = {};

    // Add filters if they exist in query
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (equipment) filter.equipment = equipment;
    if (primaryMuscle) filter.primaryMuscle = primaryMuscle;
    
    // Handle custom exercises
    if (isCustom === 'true') {
        filter.isCustom = true;
        filter.user = req.user._id; // Only show user's custom exercises
    } else if (isCustom === 'false') {
        filter.isCustom = false;
    }

    const exercises = await Exercise.find(filter).populate('user', 'name');
    res.json(exercises);
});

// @desc    Get exercise by ID
// @route   GET /api/exercises/:id
// @access  Public
const getExerciseById = asyncHandler(async (req, res) => {
    const exercise = await Exercise.findById(req.params.id).populate('user', 'name');
    
    if (exercise) {
        // Check if trying to access private custom exercise
        if (exercise.isCustom && (!req.user || exercise.user.toString() !== req.user._id.toString())) {
            res.status(403);
            throw new Error('Not authorized to access this custom exercise');
        }
        res.json(exercise);
    } else {
        res.status(404);
        throw new Error('Exercise not found');
    }
});

// @desc    Update exercise
// @route   PUT /api/exercises/:id
// @access  Private
const updateExercise = asyncHandler(async (req, res) => {
    const exercise = await Exercise.findById(req.params.id);

    if (exercise) {
        // Only allow updating custom exercises that belong to the user
        if (!exercise.isCustom || exercise.user.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error('Not authorized to update this exercise');
        }

        const {
            name,
            description,
            category,
            primaryMuscle,
            otherMuscles,
            type,
            equipment,
            instructions,
            videoUrl
        } = req.body;

        exercise.name = name || exercise.name;
        exercise.description = description || exercise.description;
        exercise.category = category || exercise.category;
        exercise.primaryMuscle = primaryMuscle || exercise.primaryMuscle;
        exercise.otherMuscles = otherMuscles || exercise.otherMuscles;
        exercise.type = type || exercise.type;
        exercise.equipment = equipment || exercise.equipment;
        exercise.instructions = instructions || exercise.instructions;
        exercise.videoUrl = videoUrl || exercise.videoUrl;

        const updatedExercise = await exercise.save();
        res.json(updatedExercise);
    } else {
        res.status(404);
        throw new Error('Exercise not found');
    }
});

// @desc    Delete exercise
// @route   DELETE /api/exercises/:id
// @access  Private
const deleteExercise = asyncHandler(async (req, res) => {
    const exercise = await Exercise.findById(req.params.id);

    if (exercise) {
        // Only allow deleting custom exercises that belong to the user
        if (!exercise.isCustom || exercise.user.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error('Not authorized to delete this exercise');
        }

        await exercise.deleteOne();
        res.json({ message: 'Exercise removed' });
    } else {
        res.status(404);
        throw new Error('Exercise not found');
    }
});

// @desc    Search exercises
// @route   GET /api/exercises/search
// @access  Public
const searchExercises = asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        res.status(400);
        throw new Error('Please provide a search query');
    }

    const exercises = await Exercise.find(
        {
            $text: { $search: q },
            $or: [
                { isCustom: false },
                { user: req.user ? req.user._id : null }
            ]
        },
        { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .populate('user', 'name');

    res.json(exercises);
});

module.exports = {
    createExercise,
    getExercises,
    getExerciseById,
    updateExercise,
    deleteExercise,
    searchExercises
};