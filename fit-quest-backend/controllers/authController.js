const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

const formatUserResponse = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  profile: user.profile
});

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const user = await User.create({ username, email, password, profile: {}});
    user.password = undefined; // Hide password in response
    const token = generateToken(user._id);
    res.status(201).json({success: true, data: { user: formatUserResponse(user), token } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    user.password = undefined; // Hide password in response
    res.status(200).json({ success: true, data: { user: formatUserResponse(user), token } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, data: { user: formatUserResponse(user) } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { profile } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update profile fields
    if (profile) {
      if (profile.age !== undefined) user.profile.age = profile.age;
      if (profile.height !== undefined) user.profile.height = profile.height;
      if (profile.weight !== undefined) user.profile.weight = profile.weight;
      if (profile.firstName !== undefined) user.profile.firstName = profile.firstName;
      if (profile.lastName !== undefined) user.profile.lastName = profile.lastName;
    }

    await user.save();
    user.password = undefined; // Hide password in response

    res.status(200).json({ 
      success: true, 
      data: { user: formatUserResponse(user) } 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
