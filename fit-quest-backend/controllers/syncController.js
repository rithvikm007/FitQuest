const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');
const Plan = require('../models/Plan');
const User = require('../models/User');

// @desc    Sync data from client to server
// @route   POST /api/sync
// @access  Private
exports.sync = asyncHandler(async (req, res) => {
    const { deviceId, workouts, plans, exercises, weights } = req.body;
  
    // UPSERT workouts
    for (const workout of workouts || []) {
        await Workout.findOneAndUpdate(
            { _id: workout._id, user: req.user._id },
            { $set: workout },
            { upsert: true, new: true }
        );
    }
  
    // UPSERT custom exercises
    for (const exercise of exercises || []) {
        if (exercise.isCustom) {
            await Exercise.findOneAndUpdate(
                { _id: exercise._id, user: req.user._id },
                { $set: exercise },
                { upsert: true }
            );
        }
    }
  
    // UPSERT plans
    for (const plan of plans || []) {
        await Plan.findOneAndUpdate(
            { _id: plan._id, user: req.user._id },
            { $set: plan },
            { upsert: true }
        );
    }
  
    // Add weights to bodyWeightHistory
    if (weights && weights.length > 0) {
        const user = await User.findById(req.user._id);
        const newWeights = weights.filter(w => !user.bodyWeightHistory.some(hw => 
            hw._id === w._id || (Math.abs(hw.measuredAt - w.measuredAt) < 5000)
        ));
    
        for (const weight of newWeights || []) {
            await User.findByIdAndUpdate(req.user._id, {
            $push: { bodyWeightHistory: { $each: [weight], $position: 0 } },
            $set: { 'profile.weight': weight.weight }
            });
        }
    }
  
    // Reset pendingChanges for this device
    await User.updateOne(
        { 'syncInfo.deviceId': deviceId },
        { 
            $set: { 
                'syncInfo.$.lastSyncAt': new Date(),
                'syncInfo.$.pendingChanges': 0 
            }
        }
    );

    const syncTime = new Date(req.body.lastSyncAt || 0);
  
    // Fetch latest workouts and plans updated after last sync
    const latestWorkouts = await Workout.find({ 
        user: req.user._id, 
        updatedAt: { $gt: syncTime }
    }).populate('exercises.exercise sourcePlan','name category equipment');

    const latestPlans = await Plan.find({ 
        user: req.user._id, 
        updatedAt: { $gt: syncTime }
    }).populate('exercises');

    // Fetch system exercises (isCustom: false) and user-created exercises (isCustom: true, user: req.user._id) updated after lastSyncAt
    const latestExercises = await Exercise.find({
        $and: [
            {
                $or: [
                    { isCustom: false },
                    { isCustom: true, user: req.user._id }
                ]
            },
            { updatedAt: { $gt: syncTime } }
        ]
    });


    // Return to client
    res.json({ 
        success: true,
        uploaded: { workouts: workouts?.length || 0 },
        downloaded: { 
            workouts: latestWorkouts,
            plans: latestPlans,
            exercises: latestExercises
        }
    });
});
