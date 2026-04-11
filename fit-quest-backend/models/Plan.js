const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	name: {
		type: String,
		required: true // "Push Day", "Legs Volume"
	},
  	plannedDate: { type: Date }, // optional future date
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
			notes: { type: String } // optional notes for the set
		}]
	}]
}, { timestamps: true });

planSchema.index({ user: 1 });

module.exports = mongoose.model('Plan', planSchema);