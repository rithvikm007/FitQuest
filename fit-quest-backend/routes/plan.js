const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    searchPlans
} = require('../controllers/planController');

// Search route
router.get('/search', protect, searchPlans);

// Protected routes
router.post('/', protect, createPlan);
router.get('/', protect, getPlans);
router.get('/:id', protect, getPlanById);
router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;