const mongoose = require('mongoose');

const setSegmentSchema = {
    reps: { type: Number },
    weight: { type: Number },
    weightUnit: {
        type: String,
        enum: ['kg', 'lb'],
        default: 'kg'
    },
    weightKg: { type: Number },
    duration: { type: Number },
    distance: { type: Number },
    notes: { type: String }
};

const workoutSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    name: { type: String }, // Optional workout name
    exercises: [{
        exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
        sets: [{
            reps: { type: Number }, // for strength training
            weight: { type: Number }, // value entered by user
            weightUnit: {
                type: String,
                enum: ['kg', 'lb'],
                default: 'kg'
            },
            weightKg: { type: Number }, // canonical value for calculations
            duration: { type: Number }, // seconds, for cardio
            distance: { type: Number }, // meters/km, for cardio
            notes: { type: String }, // optional notes for the set
            segments: [setSegmentSchema] // drop/pyramid entries grouped under one set
        }]
    }],
    notes: { type: String },
    sourcePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }
}, { timestamps: true });

workoutSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Workout', workoutSchema);