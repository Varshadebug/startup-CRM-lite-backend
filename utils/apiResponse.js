/**
 * Helper function for returning a consistent success response.
 * 
 * @param {Object} res - Express response object
 * @param {any} data - The payload to send
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Helper function for returning a consistent error response.
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {any} errors - Additional error details (default: null)
 */
export const errorResponse = (res, message, statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

/**
 * Helper function for returning a consistent paginated response.
 * 
 * @param {Object} res - Express response object
 * @param {Array} data - The paginated data
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Number of items per page
 */
export const paginatedResponse = (res, data, total, page, limit) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
};
