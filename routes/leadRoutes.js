import express from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getLeads,
  createLead,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
  getMonthlyStats,
  searchLeads
} from '../controllers/leadController.js';

const router = express.Router();

// Apply protect middleware to ALL routes in this file
router.use(protect);

const statusValues = ['New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost'];
const sourceValues = ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Email Campaign', 'Other'];

// Validation rules for creating/updating a lead
const leadValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('company').trim().notEmpty().withMessage('Company is required'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email'),
  body('status').optional().isIn(statusValues).withMessage(`Status must be one of: ${statusValues.join(', ')}`),
  body('source').optional().isIn(sourceValues).withMessage(`Source must be one of: ${sourceValues.join(', ')}`)
];

// Validation rule specifically for updating lead status
const statusValidation = [
  body('status').notEmpty().withMessage('Status is required').isIn(statusValues).withMessage(`Status must be one of: ${statusValues.join(', ')}`)
];

// Wire up endpoints

// 1. Get all leads (with pagination, filter, search)
router.get('/', getLeads);

// 2. Create a lead
router.post('/', validate(leadValidation), createLead);

// 3. Get Dashboard Stats
// Placed before /:id to prevent the route from being intercepted as a lead ID
router.get('/stats', getLeadStats);

// 4. Get Monthly Stats
// Placed before /:id to prevent the route from being intercepted as a lead ID
router.get('/monthly-stats', getMonthlyStats);

// 5. Search leads for autocomplete
router.get('/search', searchLeads);

// 5. Get a single lead by ID
router.get('/:id', getLeadById);

// 6. Update a lead
router.put('/:id', validate(leadValidation), updateLead);

// 7. Update lead status only
router.patch('/:id/status', validate(statusValidation), updateLeadStatus);

// 8. Delete a lead
router.delete('/:id', deleteLead);

export default router;
