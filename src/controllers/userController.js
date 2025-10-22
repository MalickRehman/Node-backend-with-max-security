import User from '../models/User.mongoose.js';
import logger from '../utils/logger.js';

/**
 * User Controller
 * Handles user-related HTTP requests
 */

class UserController {
  /**
   * Get all users (admin only)
   * GET /api/v1/users
   */
  static async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      const role = req.query.role;

      const query = role ? { role } : {};

      const users = await User.find(query)
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(query);

      return res.status(200).json({
        success: true,
        data: {
          users: users.map((u) => u.toJSON()),
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get all users controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to get users',
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:userId
   */
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Get user by ID controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to get user',
      });
    }
  }

  /**
   * Update user
   * PATCH /api/v1/users/:userId
   */
  static async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Update user controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update user',
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/v1/users/:userId
   */
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByIdAndDelete(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Delete user controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete user',
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  static async getMyProfile(req, res) {
    try {
      const userId = req.userId;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Get my profile controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to get profile',
      });
    }
  }

  /**
   * Update current user profile
   * PATCH /api/v1/users/me
   */
  static async updateMyProfile(req, res) {
    try {
      const userId = req.userId;
      const updates = req.body;

      // Users can only update certain fields on their own profile
      const allowedUpdates = ['firstName', 'lastName'];
      const filteredUpdates = {};

      allowedUpdates.forEach((key) => {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      });

      const user = await User.findByIdAndUpdate(userId, filteredUpdates, { new: true, runValidators: true });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Update my profile controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update profile',
      });
    }
  }

  /**
   * Update user role (admin only)
   * PATCH /api/v1/users/:userId/role
   */
  static async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Prevent users from changing their own role
      if (req.userId === userId) {
        return res.status(403).json({
          success: false,
          message: 'You cannot change your own role',
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update role
      user.role = role;
      await user.save();

      logger.info(`User role updated: ${userId} -> ${role} by ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: 'User role updated successfully',
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Update user role controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to update user role',
      });
    }
  }

  /**
   * Activate/Deactivate user (admin only)
   * PATCH /api/v1/users/:userId/status
   */
  static async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      // Prevent users from deactivating themselves
      if (req.userId === userId) {
        return res.status(403).json({
          success: false,
          message: 'You cannot change your own status',
        });
      }

      const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true, runValidators: true });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      logger.info(`User status updated: ${userId} -> ${isActive ? 'active' : 'inactive'} by ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('Update user status controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to update user status',
      });
    }
  }
}

export default UserController;
