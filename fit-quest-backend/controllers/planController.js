const Plan = require('../models/Plan');
const asyncHandler = require('express-async-handler');
const { normalizeExerciseSets } = require('../utils/normalizeSetWeights');

// @desc    Create a new plan
// @route   POST /api/plans
// @access  Private
const createPlan = asyncHandler(async (req, res) => {
    const {
        name,
        plannedDate,
        exercises
    } = req.body;
    
    const plan = await Plan.create({
        user: req.user._id,
        name,
        plannedDate,
        exercises: normalizeExerciseSets(exercises)
    });
    const populatedPlan = await Plan.findById(plan._id).populate('exercises.exercise', 'name');
    res.status(201).json(populatedPlan);
});

// @desc    Get all plans for the authenticated user
// @route   GET /api/plans
// @access  Private
const getPlans = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const plans = await Plan.find({ user: req.user._id })
        .populate('exercises.exercise', 'name')
        .sort({ plannedDate: 1 })
        .limit(limit)
        .skip((page - 1) * limit);
    res.json(plans);
});

// @desc    Get a single plan by ID
// @route   GET /api/plans/:id
// @access  Private
const getPlanById = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id).populate('exercises.exercise', 'name');
    if (plan && plan.user.toString() === req.user._id.toString()) {
        res.json(plan);
    } else {
        res.status(404);
        throw new Error('Plan not found');
    }
});

// @desc   Update a plan
// @route  PUT /api/plans/:id
// @access Private
const updatePlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id).populate('exercises.exercise', 'name');
    if (plan && plan.user.toString() === req.user._id.toString()) {
        const {
            name,
            plannedDate,
            exercises
        } = req.body;
        plan.name = name || plan.name;
        plan.plannedDate = plannedDate || plan.plannedDate;
        plan.exercises = exercises ? normalizeExerciseSets(exercises) : plan.exercises;
        await plan.save();
        const updatedPlan = await Plan.findById(req.params.id).populate('exercises.exercise', 'name');
        res.json(updatedPlan);
    } else {
        res.status(404);
        throw new Error('Plan not found');
    }
});

// @desc   Delete a plan
// @route  DELETE /api/plans/:id
// @access Private
const deletePlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id);
    if (plan && plan.user.toString() === req.user._id.toString()) {
        await plan.deleteOne();
        res.json({ message: 'Plan removed' });
    } else {
        res.status(404);
        throw new Error('Plan not found');
    }
});

const searchPlans = asyncHandler(async (req, res) => {
    const { query } = req.query;
    const plans = await Plan.find({
        user: req.user._id,
        name: { $regex: query, $options: 'i' }
    }).populate('exercises.exercise', 'name');
    res.json(plans);
});

module.exports = {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    searchPlans
};