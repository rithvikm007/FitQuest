const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validatePlan } = require('../middleware/validation');
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
router.post('/', protect, validatePlan, createPlan);
router.get('/', protect, getPlans);
router.get('/:id', protect, getPlanById);
router.put('/:id', protect, validatePlan, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;