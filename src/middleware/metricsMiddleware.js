import metricsService from '../services/metricsService.js';

/**
 * Metrics collection middleware
 * Records HTTP request metrics
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    try {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const statusCode = res.statusCode;

      // Record metrics
      metricsService.recordHttpRequest(method, route, statusCode, duration);

      // Record rate limit hits
      if (statusCode === 429) {
        metricsService.recordRateLimitHit(route);
      }

      // Record API errors
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        metricsService.recordApiError(errorType, route);
      }
    } catch (error) {
      // Don't let metrics collection break the app
      console.error('Metrics collection error:', error);
    }
  });

  next();
};

export default metricsMiddleware;
