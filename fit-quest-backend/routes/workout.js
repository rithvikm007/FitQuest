const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateWorkout } = require('../middleware/validation');
const {
    createWorkout,
    getWorkouts,
    getWorkoutById,
    updateWorkout,
    deleteWorkout,
    searchWorkouts,
    startWorkoutFromPlan
} = require('../controllers/workoutController');

// Search route
router.get('/search', protect, searchWorkouts);

// Protected routes
router.post('/', protect, validateWorkout, createWorkout);
router.post('/from-plan/:id', protect, startWorkoutFromPlan);
router.get('/', protect, getWorkouts);
router.get('/:id', protect, getWorkoutById);
router.put('/:id', protect, validateWorkout, updateWorkout);
router.delete('/:id', protect, deleteWorkout);

module.exports = router;