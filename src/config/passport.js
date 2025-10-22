import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import config from './environment.js';
import User from '../models/User.mongoose.js';
import logger from '../utils/logger.js';

/**
 * Serialize user for session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    logger.error('Error deserializing user:', error);
    done(error, null);
  }
});

/**
 * Google OAuth Strategy
 */
if (config.features.enableOAuth && config.oauth.google.clientId) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.oauth.google.clientId,
        clientSecret: config.oauth.google.clientSecret,
        callbackURL: `${config.app.baseUrl || `http://${config.host}:${config.port}`}${config.app.apiPrefix}/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info(`Google OAuth attempt for email: ${profile.emails?.[0]?.value}`);

          // Check if user already exists with this Google ID
          let user = await User.findOne({ 'oauth.google.id': profile.id });

          if (user) {
            // User exists with Google OAuth
            logger.info(`Existing Google OAuth user logged in: ${user.email}`);
            return done(null, user);
          }

          // Check if user exists with the same email
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email provided by Google'), null);
          }

          user = await User.findOne({ email });

          if (user) {
            // Link Google account to existing user
            user.oauth.google = {
              id: profile.id,
              email: profile.emails?.[0]?.value,
              displayName: profile.displayName,
            };
            user.isEmailVerified = true; // Google accounts are verified
            await user.save();

            logger.info(`Linked Google account to existing user: ${user.email}`);
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            email,
            username: profile.emails?.[0]?.value.split('@')[0] + '_' + Date.now(),
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            isEmailVerified: true,
            oauth: {
              google: {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                displayName: profile.displayName,
              },
            },
            authProvider: 'google',
          });

          await newUser.save();

          logger.info(`New user created via Google OAuth: ${newUser.email}`);
          return done(null, newUser);
        } catch (error) {
          logger.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  logger.info('✅ Google OAuth strategy configured');
}

/**
 * GitHub OAuth Strategy
 */
if (config.features.enableOAuth && config.oauth.github.clientId) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.oauth.github.clientId,
        clientSecret: config.oauth.github.clientSecret,
        callbackURL: `${config.app.baseUrl || `http://${config.host}:${config.port}`}${config.app.apiPrefix}/auth/github/callback`,
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info(`GitHub OAuth attempt for username: ${profile.username}`);

          // Check if user already exists with this GitHub ID
          let user = await User.findOne({ 'oauth.github.id': profile.id });

          if (user) {
            // User exists with GitHub OAuth
            logger.info(`Existing GitHub OAuth user logged in: ${user.email}`);
            return done(null, user);
          }

          // Get primary email from GitHub
          const primaryEmail = profile.emails?.find((email) => email.primary)?.value || profile.emails?.[0]?.value;

          if (!primaryEmail) {
            return done(new Error('No email provided by GitHub'), null);
          }

          // Check if user exists with the same email
          user = await User.findOne({ email: primaryEmail });

          if (user) {
            // Link GitHub account to existing user
            user.oauth.github = {
              id: profile.id,
              username: profile.username,
              profileUrl: profile.profileUrl,
            };
            user.isEmailVerified = true; // GitHub accounts are verified
            await user.save();

            logger.info(`Linked GitHub account to existing user: ${user.email}`);
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            email: primaryEmail,
            username: profile.username || 'github_' + profile.id,
            firstName: profile.displayName?.split(' ')[0] || '',
            lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
            isEmailVerified: true,
            oauth: {
              github: {
                id: profile.id,
                username: profile.username,
                profileUrl: profile.profileUrl,
              },
            },
            authProvider: 'github',
          });

          await newUser.save();

          logger.info(`New user created via GitHub OAuth: ${newUser.email}`);
          return done(null, newUser);
        } catch (error) {
          logger.error('GitHub OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  logger.info('✅ GitHub OAuth strategy configured');
}

export default passport;
