const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    createExercise,
    getExercises,
    getExerciseById,
    updateExercise,
    deleteExercise,
    searchExercises
} = require('../controllers/exerciseController');

// Search route should be before /:id to prevent conflicts
router.get('/search', searchExercises);

// Public routes
router.get('/', getExercises);
router.get('/:id', getExerciseById);

// Protected routes
router.post('/', protect, createExercise);
router.put('/:id', protect, updateExercise);
router.delete('/:id', protect, deleteExercise);

module.exports = router;