/**
 * Standardized API Response Helper
 * Creates consistent response structure across all endpoints
 */

class ApiResponse {
  constructor(statusCode, data, message, metadata = {}) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;

    // Add optional metadata (pagination, timestamps, etc.)
    if (Object.keys(metadata).length > 0) {
      this.metadata = metadata;
    }

    // Add timestamp
    this.timestamp = new Date().toISOString();
  }

  // Static methods for common success responses
  static success(data, message = 'Success', metadata = {}) {
    return new ApiResponse(200, data, message, metadata);
  }

  static created(data, message = 'Resource created successfully', metadata = {}) {
    return new ApiResponse(201, data, message, metadata);
  }

  static accepted(data, message = 'Request accepted', metadata = {}) {
    return new ApiResponse(202, data, message, metadata);
  }

  static noContent(message = 'No content') {
    return new ApiResponse(204, null, message);
  }

  // Send response helper
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      ...(this.data !== null && this.data !== undefined && { data: this.data }),
      ...(this.metadata && { metadata: this.metadata }),
      timestamp: this.timestamp,
    });
  }
}

export default ApiResponse;
