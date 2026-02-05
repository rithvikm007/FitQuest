const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        maxLength: 200  // Brief overview of the exercise
    },
    category: {
        type: String,
        enum: ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full body'],
        required: true
    },
    primaryMuscle: {
        type: String,
        enum: ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'cardio', 'chest', 'forearms', 'full body', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'obliques', 'core', 'shoulders', 'traps', 'triceps', 'upper back', 'other'],
        required: true,
        default: 'other'
    },
    otherMuscles: [{
        type: String,
        enum: ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'cardio', 'chest', 'forearms', 'full body', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'obliques', 'core', 'quadriceps', 'shoulders', 'traps', 'triceps', 'upper back', 'other']
    }],
    type: {
        type: String,
        enum: ['weight and reps', 'bodyweight reps', 'weighted bodyweight', 'assisted bodyweight', 'duration', 'duration and weight', 'distance and duration', 'weight and distance'],
        required: true,
        default: 'weight and reps'
    },
    equipment: {
        type: String,
        enum: ['band', 'cable', 'dumbbell', 'barbell', 'body weight', 'kettlebell', 'machine', 'medicine ball', 'olympic barbell', 'resistance band', 'rope', 'sled', 'smith machine', 'stability ball', 'step', 'tire', 'weight plate', 'other'],
        required: true,
        default: 'other' 
    },
    isCustom: {
        type: Boolean,
        default: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return this.isCustom; } 
    },
    instructions: {
        type: [String],
        required: true,
        validate: [
            {
                validator: function(array) {
                    return array.length > 0;
                },
                message: 'Instructions cannot be empty'
            },
            {
                validator: function(array) {
                    return array.every(step => step.length <= 200);
                },
                message: 'Each instruction step must be 200 characters or less'
            }
        ]
    },
    videoUrl: String

}, { timestamps: true });

exerciseSchema.index({ name: 'text', description: 'text' });
exerciseSchema.index({ category: 1, isCustom: 1 });
exerciseSchema.index({ user: 1 });
exerciseSchema.index({ name: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);