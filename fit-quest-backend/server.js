const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRoutes = require('./routes/user');
const exerciseRoutes = require('./routes/exercise');
const workoutRoutes = require('./routes/workout');
const planRoutes = require('./routes/plan');
const syncRoutes = require('./routes/sync');
require('dotenv').config({ path: './.env' });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', userRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/sync', syncRoutes);

main()
    .then(() => {
        console.log("Connected to Database");
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
    await mongoose.connect(process.env.MONGODB_URL);
}


app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'FitQuest API v1.0',
    endpoints: {
      auth: '/api/auth',
      exercises: '/api/exercises',
      workouts: '/api/workouts',
      plans: '/api/plans',
      sync: '/api/sync'
    }
  });
});

// Error handling middleware - must be after all routes
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
