import ApiResponse from '../utils/ApiResponse.js';

/**
 * Response Handler Middleware
 * Standardizes all API responses
 */

/**
 * Add response helpers to res object
 */
export const responseHandler = (req, res, next) => {
  // Success response helper
  res.success = (data, message = 'Success', statusCode = 200, metadata = {}) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(Object.keys(metadata).length > 0 && { metadata }),
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  };

  // Created response helper
  res.created = (data, message = 'Resource created successfully', metadata = {}) => {
    return res.status(201).json({
      success: true,
      message,
      data,
      ...(Object.keys(metadata).length > 0 && { metadata }),
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  };

  // Accepted response helper
  res.accepted = (data, message = 'Request accepted', metadata = {}) => {
    return res.status(202).json({
      success: true,
      message,
      data,
      ...(Object.keys(metadata).length > 0 && { metadata }),
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  };

  // No content response helper
  res.noContent = (message = 'No content') => {
    return res.status(204).send();
  };

  // Paginated response helper
  res.paginated = (data, page, limit, total, message = 'Success') => {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  };

  // Error response helper (fallback, use errorHandler middleware instead)
  res.error = (statusCode, message, errors = null) => {
    const response = {
      success: false,
      message,
      statusCode,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  };

  next();
};

/**
 * Response time middleware
 * Adds X-Response-Time header
 */
export const responseTime = (req, res, next) => {
  const start = Date.now();

  // Set header before response is sent
  const originalSend = res.send.bind(res);
  res.send = function (data) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalSend(data);
  };

  next();
};

/**
 * Cache control middleware
 */
export const cacheControl = (options = {}) => {
  return (req, res, next) => {
    const {
      maxAge = 0,
      sMaxAge,
      noCache = false,
      noStore = false,
      mustRevalidate = false,
      public: isPublic = false,
      private: isPrivate = false,
    } = options;

    const directives = [];

    if (noCache) {
      directives.push('no-cache');
    }
    if (noStore) {
      directives.push('no-store');
    }
    if (mustRevalidate) {
      directives.push('must-revalidate');
    }
    if (isPublic) {
      directives.push('public');
    }
    if (isPrivate) {
      directives.push('private');
    }
    if (maxAge > 0) {
      directives.push(`max-age=${maxAge}`);
    }
    if (sMaxAge) {
      directives.push(`s-maxage=${sMaxAge}`);
    }

    if (directives.length > 0) {
      res.setHeader('Cache-Control', directives.join(', '));
    }

    next();
  };
};

/**
 * API response formatter middleware
 * Automatically wraps responses in standard format
 */
export const formatResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // If data is already formatted (has success property), send as-is
    if (data && typeof data === 'object' && 'success' in data) {
      return originalJson(data);
    }

    // Otherwise, format it
    const formattedData = {
      success: res.statusCode >= 200 && res.statusCode < 300,
      data,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    return originalJson(formattedData);
  };

  next();
};

/**
 * CORS headers middleware (additional to cors package)
 */
export const corsHeaders = (req, res, next) => {
  // Add additional CORS headers if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '600');

  next();
};

/**
 * Compression preference middleware
 */
export const compressionPreference = (req, res, next) => {
  // Check if client accepts compression
  const acceptEncoding = req.headers['accept-encoding'] || '';

  if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
  } else if (acceptEncoding.includes('deflate')) {
    res.setHeader('Content-Encoding', 'deflate');
  } else if (acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
  }

  next();
};

export default {
  responseHandler,
  responseTime,
  cacheControl,
  formatResponse,
  corsHeaders,
  compressionPreference,
};
