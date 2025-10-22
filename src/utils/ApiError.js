/**
 * Custom API Error Class
 * Extends the native Error class with additional properties
 */

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Static methods for common errors
  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not Found') {
    return new ApiError(404, message);
  }

  static methodNotAllowed(message = 'Method Not Allowed') {
    return new ApiError(405, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static unprocessableEntity(message = 'Unprocessable Entity') {
    return new ApiError(422, message);
  }

  static tooManyRequests(message = 'Too Many Requests') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message, false);
  }

  static notImplemented(message = 'Not Implemented') {
    return new ApiError(501, message);
  }

  static badGateway(message = 'Bad Gateway') {
    return new ApiError(502, message, false);
  }

  static serviceUnavailable(message = 'Service Unavailable') {
    return new ApiError(503, message, false);
  }

  static gatewayTimeout(message = 'Gateway Timeout') {
    return new ApiError(504, message, false);
  }
}

export default ApiError;
