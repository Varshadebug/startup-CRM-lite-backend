import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

export const register = async (req, res) => {
  console.log('[AUTH] Registration attempt received');
  const { name, email, password } = req.body;
  
  // Do not log the password for security, just confirm it exists
  console.log(`[AUTH] Payload - Name: ${name}, Email: ${email}, Password exists: ${!!password}`);

  console.log('[AUTH] Checking for existing user...');
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log(`[AUTH] Registration failed: Email ${email} already exists`);
    return res.status(400).json({ success: false, message: 'Email already exists' });
  }

  console.log('[AUTH] Creating new user in MongoDB...');
  const user = await User.create({
    name,
    email,
    password
  });
  console.log(`[AUTH] User created successfully with ID: ${user._id}`);

  console.log('[AUTH] Generating JWT token...');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  const userWithoutPassword = user.toObject();
  delete userWithoutPassword.password;

  console.log('[AUTH] Registration complete, sending success response');
  return res.status(201).json({
    success: true,
    token,
    user: userWithoutPassword
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  const token = generateToken(user._id);

  const userWithoutPassword = user.toObject();
  delete userWithoutPassword.password;

  return res.status(200).json({
    success: true,
    token,
    user: userWithoutPassword
  });
};

export const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

export const updateProfile = async (req, res) => {
  const { name, password, oldPassword } = req.body;
  
  const user = await User.findById(req.user._id).select('+password');

  if (name) {
    user.name = name;
  }

  if (password) {
    if (!oldPassword) {
      return res.status(400).json({ success: false, message: 'Old password is required to change password' });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    user.password = password; // pre-save hook handles hashing
  }

  await user.save();

  const updatedUser = user.toObject();
  delete updatedUser.password;

  return res.status(200).json({
    success: true,
    user: updatedUser
  });
};
