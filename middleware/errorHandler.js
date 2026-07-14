/**
 * Global Express error handler middleware.
 * Catches errors throughout the app and formats them into a standard API response.
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const errorHandler = (err, req, res, next) => {
  // Default to 500 server error if status code isn't already set to an error code
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Server error';
  let errors = null;

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    // Extract field-by-field error messages
    errors = Object.values(err.errors).map(val => val.message);
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Handle MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Email already exists';
  }

  // Handle JWT errors (JsonWebTokenError, TokenExpiredError)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Not authorized, token failed';
  }

  // Prepare response payload
  const response = {
    success: false,
    message,
    errors
  };

  // In development: include err.stack in the response
  // In production: never send stack traces
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Send the error response
  res.status(statusCode).json(response);
};
