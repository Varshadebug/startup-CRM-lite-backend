import Lead from '../models/Lead.js';

/**
 * Get leads with pagination, filtering, and search
 * @param {Object} req - Express request object containing query params: page, limit, sortBy, sortOrder, status, search, source, dateFrom, dateTo
 * @param {Object} res - Express response object
 */
export const getLeads = async (req, res) => {
  const { 
    status, 
    search, 
    source,
    dateFrom,
    dateTo,
    page = 1, 
    limit = 20, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query;
  
  if (process.env.NODE_ENV === 'development') console.log('Fetching leads for user:', req.user._id);

  const filter = { owner: req.user._id };

  if (status && status !== 'All') {
    filter.status = status;
  }

  if (source && source !== 'All') {
    filter.source = source;
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { name: { $regex: regex } },
      { company: { $regex: regex } },
      { email: { $regex: regex } }
    ];
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const skip = (Number(page) - 1) * Number(limit);

  const leads = await Lead.find(filter)
    .sort({ [sortBy]: sortDirection })
    .skip(skip)
    .limit(Number(limit));

  const totalLeads = await Lead.countDocuments(filter);
  const totalPages = Math.ceil(totalLeads / Number(limit));

  res.status(200).json({
    success: true,
    data: leads,
    pagination: {
      total: totalLeads,
      page: Number(page),
      limit: Number(limit),
      pages: totalPages,
      hasNext: Number(page) < totalPages,
      hasPrev: Number(page) > 1
    }
  });
};

/**
 * Create a new lead
 */
export const createLead = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log('Creating lead for user:', req.user._id);

  const { name, company, email, phone, status, source, notes } = req.body;

  const lead = await Lead.create({
    name,
    company,
    email,
    phone,
    status,
    source,
    notes,
    owner: req.user._id
  });

  res.status(201).json({
    success: true,
    data: lead
  });
};

/**
 * Get a lead by ID
 */
export const getLeadById = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log(`Fetching lead ${req.params.id} for user:`, req.user._id);

  const lead = await Lead.findOne({ _id: req.params.id, owner: req.user._id });

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  res.status(200).json({
    success: true,
    data: lead
  });
};

/**
 * Update a lead
 */
export const updateLead = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log(`Updating lead ${req.params.id} for user:`, req.user._id);

  // Ensure we don't accidentally update the owner
  const updateData = { ...req.body };
  delete updateData.owner;

  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  res.status(200).json({
    success: true,
    data: lead
  });
};

/**
 * Update lead status only
 */
export const updateLeadStatus = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log(`Updating lead status for ${req.params.id} for user:`, req.user._id);

  const { status } = req.body;

  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { status },
    { new: true, runValidators: true }
  );

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  res.status(200).json({
    success: true,
    data: lead
  });
};

/**
 * Delete a lead
 */
export const deleteLead = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log(`Deleting lead ${req.params.id} for user:`, req.user._id);

  const lead = await Lead.findOne({ _id: req.params.id, owner: req.user._id });

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  await lead.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Lead deleted successfully'
  });
};

/**
 * Get lead statistics for dashboard using MongoDB Aggregation Pipeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getLeadStats = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log('Fetching lead stats for user:', req.user._id);

  const now = new Date();
  
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const stats = await Lead.aggregate([
    { $match: { owner: req.user._id } },
    {
      $facet: {
        totalLeads: [{ $count: "count" }],
        statusBreakdown: [
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ],
        sourceBreakdown: [
          { $group: { _id: "$source", count: { $sum: 1 } } }
        ],
        thisMonthLeads: [
          { $match: { createdAt: { $gte: startOfThisMonth } } },
          { $count: "count" }
        ],
        lastMonthLeads: [
          { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
          { $count: "count" }
        ]
      }
    }
  ]);

  // Extract counts with fallbacks
  const total = stats[0].totalLeads[0]?.count || 0;
  
  // Reformat breakdowns into { "Status": Count } objects
  const statusObj = stats[0].statusBreakdown.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});
  
  const sourceObj = stats[0].sourceBreakdown.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const wonLeads = statusObj['Won'] || 0;
  const lostLeads = statusObj['Lost'] || 0;
  const conversionRate = total > 0 ? parseFloat(((wonLeads / total) * 100).toFixed(1)) : 0;
  
  const thisMonth = stats[0].thisMonthLeads[0]?.count || 0;
  const lastMonth = stats[0].lastMonthLeads[0]?.count || 0;
  
  let growthRate = 0;
  if (lastMonth > 0) {
    growthRate = parseFloat((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1));
  } else if (thisMonth > 0) {
    growthRate = 100; // 100% growth from 0
  }

  res.status(200).json({
    success: true,
    data: {
      totalLeads: total,
      statusBreakdown: statusObj,
      conversionRate,
      sourceBreakdown: sourceObj,
      thisMonthLeads: thisMonth,
      lastMonthLeads: lastMonth,
      growthRate,
      wonLeads,
      lostLeads
    }
  });
};

/**
 * Get monthly lead statistics for the last 6 months
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMonthlyStats = async (req, res) => {
  if (process.env.NODE_ENV === 'development') console.log('Fetching monthly stats for user:', req.user._id);

  const now = new Date();
  
  // Calculate the start date of the month exactly 5 months ago (to get 6 months total)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const monthlyStats = await Lead.aggregate([
    {
      $match: {
        owner: req.user._id,
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: 1 },
        won: {
          $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] }
        },
        lost: {
          $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
        }
      }
    }
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Map raw stats to a dictionary for easy lookup
  const statsDict = monthlyStats.reduce((acc, stat) => {
    const key = `${stat._id.year}-${stat._id.month}`;
    const conversionRate = stat.total > 0 ? parseFloat(((stat.won / stat.total) * 100).toFixed(1)) : 0;
    
    acc[key] = {
      total: stat.total,
      won: stat.won,
      lost: stat.lost,
      conversionRate
    };
    return acc;
  }, {});

  // Generate the last 6 months sequentially, filling in 0s for missing months
  const formattedStats = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const key = `${year}-${month}`;
    const label = `${monthNames[month - 1]} ${year}`;
    
    if (statsDict[key]) {
      formattedStats.push({
        month: label,
        ...statsDict[key]
      });
    } else {
      formattedStats.push({
        month: label,
        total: 0,
        won: 0,
        lost: 0,
        conversionRate: 0
      });
    }
  }

  res.status(200).json({
    success: true,
    data: formattedStats
  });
};

/**
 * Search leads for autocomplete
 * @param {Object} req - Express request object containing query param: q, limit
 * @param {Object} res - Express response object
 */
export const searchLeads = async (req, res) => {
  const { q, limit = 5 } = req.query;
  
  if (process.env.NODE_ENV === 'development') console.log(`Searching leads for user ${req.user._id} with query: ${q}`);

  if (!q) {
    return res.status(200).json({ success: true, data: [] });
  }

  const regex = new RegExp(q, 'i');
  const filter = {
    owner: req.user._id,
    $or: [
      { name: { $regex: regex } },
      { company: { $regex: regex } },
      { email: { $regex: regex } }
    ]
  };

  const leads = await Lead.find(filter)
    .select('_id name company email status')
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: leads
  });
};
