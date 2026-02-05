const Workout = require('../models/Workout');
const asyncHandler = require('express-async-handler');

// @desc    Create a new workout
// @route   POST /api/workouts
// @access  Private
const createWorkout = asyncHandler(async (req, res) => {
    const {
        name,
        exercises,
        notes,
        date,
        sourcePlan
    } = req.body;

    const workout = await Workout.create({
        user: req.user._id,
        name,
        exercises,
        notes,
        date,
        sourcePlan
    });

    res.status(201).json(workout);
});

// @desc    Get all workouts for the logged-in user
// @route   GET /api/workouts
// @access  Private
const getWorkouts = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const workouts = await Workout.find({ user: req.user._id })
        .populate('exercises.exercise','name category')
        .sort({ date: -1 })
        .limit(limit)
        .skip((page - 1) * limit);
    res.json(workouts);
});

// @desc    Get a single workout by ID
// @route   GET /api/workouts/:id
// @access  Private
const getWorkoutById = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id).populate('exercises.exercise','name category equipment');
    if (workout && workout.user.toString() === req.user._id.toString()) {
        res.json(workout);
    } else {
        res.status(404);
        throw new Error('Workout not found');
    }
});

// @desc   Update a workout
// @route  PUT /api/workouts/:id
// @access Private
const updateWorkout = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id).populate('exercises.exercise','name category equipment');
    if (workout && workout.user.toString() === req.user._id.toString()) {
        const { name, exercises, notes, date, sourcePlan } = req.body;
        workout.name = name || workout.name;
        workout.exercises = exercises || workout.exercises;
        workout.notes = notes || workout.notes;
        workout.date = date || workout.date;
        workout.sourcePlan = sourcePlan || workout.sourcePlan;
        await workout.save();
        const updatedWorkout = await Workout.findById(req.params.id)
            .populate('exercises.exercise');
        res.json(updatedWorkout);
    } else {
        res.status(404);
        throw new Error('Workout not found');
    }
});

// @desc    Delete a workout
// @route   DELETE /api/workouts/:id
// @access  Private
const deleteWorkout = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (workout && workout.user.toString() === req.user._id.toString()) {
        await workout.deleteOne();
        res.json({ message: 'Workout removed' });
    } else {
        res.status(404);
        throw new Error('Workout not found');
    }
});

const searchWorkouts = asyncHandler(async (req, res) => {
    const { query } = req.query;
    const workouts = await Workout.find({
        user: req.user._id,
        name: { $regex: query, $options: 'i' }
    }).sort({ date: -1 });
    res.json(workouts);
});

module.exports = {
    createWorkout,
    getWorkouts,
    getWorkoutById,
    updateWorkout,
    deleteWorkout,
    searchWorkouts
};