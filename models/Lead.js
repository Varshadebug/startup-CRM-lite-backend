import mongoose from 'mongoose';

/**
 * Lead Schema definition
 * @type {mongoose.Schema}
 */
export const leadSchema = new mongoose.Schema({
  /**
   * Full name of the lead
   * @type {String}
   */
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minLength: [2, 'Name must be at least 2 characters long'],
    maxLength: [100, 'Name cannot exceed 100 characters']
  },
  /**
   * Company name of the lead
   * @type {String}
   */
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  /**
   * Email address of the lead
   * @type {String}
   */
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Email must be a valid email address']
  },
  /**
   * Contact phone number of the lead
   * @type {String}
   */
  phone: {
    type: String,
    trim: true
  },
  /**
   * Current status of the lead in the pipeline
   * @type {String}
   */
  status: {
    type: String,
    enum: {
      values: ['New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost'],
      message: '{VALUE} is not a valid status'
    },
    default: 'New'
  },
  /**
   * Source from where the lead was acquired
   * @type {String}
   */
  source: {
    type: String,
    enum: {
      values: ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Email Campaign', 'Other'],
      message: '{VALUE} is not a valid source'
    },
    default: 'Website'
  },
  /**
   * Additional notes or context about the lead
   * @type {String}
   */
  notes: {
    type: String,
    maxLength: [1000, 'Notes cannot exceed 1000 characters']
  },
  /**
   * Reference to the User who owns/created this lead
   * @type {mongoose.Schema.Types.ObjectId}
   */
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Lead owner is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field to calculate the age of the lead in days
leadSchema.virtual('age').get(function () {
  if (!this.createdAt) return 0;

  const now = new Date();
  const diffInTime = now.getTime() - this.createdAt.getTime();
  // Convert time difference from milliseconds to days
  const diffInDays = Math.floor(diffInTime / (1000 * 3600 * 24));

  return diffInDays;
});

// Indexes for optimized querying
leadSchema.index({ owner: 1, status: 1 });
leadSchema.index({ owner: 1, createdAt: -1 });
leadSchema.index({ owner: 1, source: 1 });
leadSchema.index({ owner: 1, name: 1 });
leadSchema.index({ owner: 1, company: 1 });
leadSchema.index({ email: 1 });

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
