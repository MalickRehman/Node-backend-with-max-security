# OAuth 2.0 Integration Setup Guide

This guide explains how to set up OAuth 2.0 authentication with Google and GitHub for the Nexus UI Backend.

## Overview

OAuth 2.0 integration allows users to:
- Sign in with their Google or GitHub accounts
- Link multiple OAuth providers to a single account
- Unlink OAuth providers
- Create accounts automatically via OAuth

## Prerequisites

Before setting up OAuth, you need to:
1. Create OAuth applications in Google Cloud Console and GitHub
2. Obtain client IDs and client secrets
3. Configure callback URLs

---

## 1. Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Click **OAuth consent screen** in the left sidebar
2. Choose **External** user type (or Internal if using Google Workspace)
3. Fill in the required information:
   - **App name**: Nexus UI Backend
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Save and continue

### Step 3: Create OAuth 2.0 Credentials

1. Go to **Credentials** tab
2. Click **Create Credentials** > **OAuth 2.0 Client ID**
3. Choose **Web application**
4. Configure:
   - **Name**: Nexus UI Backend
   - **Authorized JavaScript origins**:
     - `http://localhost:5000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/v1/auth/google/callback` (development)
     - `https://yourdomain.com/api/v1/auth/google/callback` (production)
5. Click **Create**

### Step 4: Save Credentials

Copy the **Client ID** and **Client Secret** and add them to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
ENABLE_OAUTH=true
```

---

## 2. GitHub OAuth Setup

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**

### Step 2: Configure OAuth App

Fill in the application details:
- **Application name**: Nexus UI Backend
- **Homepage URL**:
  - `http://localhost:5000` (development)
  - `https://yourdomain.com` (production)
- **Application description**: (Optional)
- **Authorization callback URL**:
  - `http://localhost:5000/api/v1/auth/github/callback` (development)
  - `https://yourdomain.com/api/v1/auth/github/callback` (production)

### Step 3: Generate Client Secret

1. After creating the app, click **Generate a new client secret**
2. Copy the client secret immediately (it won't be shown again)

### Step 4: Save Credentials

Add the credentials to your `.env` file:

```env
GITHUB_CLIENT_ID=your-github-client-id-here
GITHUB_CLIENT_SECRET=your-github-client-secret-here
ENABLE_OAUTH=true
```

---

## 3. Environment Configuration

Update your `.env` file with all OAuth settings:

```env
# Enable OAuth
ENABLE_OAUTH=true

# Base URL (used for OAuth callbacks)
BASE_URL=http://localhost:5000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Frontend URL (for redirects after OAuth)
CORS_ORIGIN=http://localhost:3000
```

---

## 4. API Endpoints

### Google OAuth Flow

**1. Initiate Google OAuth**
```
GET /api/v1/auth/google
```
Redirects user to Google consent screen.

**2. Google Callback** (handled automatically)
```
GET /api/v1/auth/google/callback
```
After user approves, Google redirects here with tokens.

### GitHub OAuth Flow

**1. Initiate GitHub OAuth**
```
GET /api/v1/auth/github
```
Redirects user to GitHub authorization page.

**2. GitHub Callback** (handled automatically)
```
GET /api/v1/auth/github/callback
```
After user approves, GitHub redirects here with tokens.

### Account Management

**Get Linked Accounts**
```http
GET /api/v1/auth/oauth/linked
Authorization: Bearer <access_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "authProvider": "local",
    "linkedAccounts": {
      "google": true,
      "github": false
    }
  }
}
```

**Unlink OAuth Account**
```http
DELETE /api/v1/auth/oauth/unlink/{provider}
Authorization: Bearer <access_token>
```

Providers: `google` or `github`

Response:
```json
{
  "success": true,
  "message": "google account unlinked successfully"
}
```

---

## 5. Frontend Integration

### Initiate OAuth Login

Create login buttons in your frontend:

```javascript
// Google Login
<a href="http://localhost:5000/api/v1/auth/google">
  Login with Google
</a>

// GitHub Login
<a href="http://localhost:5000/api/v1/auth/github">
  Login with GitHub
</a>
```

### Handle OAuth Callback

Create a callback route in your frontend (`/auth/callback`):

```javascript
// Example: React
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Redirect to dashboard
      navigate('/dashboard');
    } else {
      // Handle error
      navigate('/login?error=oauth_failed');
    }
  }, [searchParams, navigate]);

  return <div>Processing login...</div>;
}
```

### Error Handling

Create an error route (`/auth/error`):

```javascript
function AuthError() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message');

  return (
    <div>
      <h2>Authentication Failed</h2>
      <p>{message || 'An error occurred during authentication'}</p>
      <a href="/login">Try Again</a>
    </div>
  );
}
```

---

## 6. Security Considerations

### Important Security Notes

1. **Never expose client secrets** in frontend code
2. **Always use HTTPS** in production
3. **Validate redirect URLs** to prevent open redirects
4. **Use state parameter** to prevent CSRF attacks (handled by Passport.js)
5. **Store tokens securely** (consider httpOnly cookies for production)

### Production Setup

For production, update your OAuth app configurations:

1. **Google Console**:
   - Add production domain to authorized origins
   - Add production callback URL

2. **GitHub Settings**:
   - Update homepage URL to production domain
   - Update callback URL to production endpoint

3. **Environment Variables**:
   ```env
   NODE_ENV=production
   BASE_URL=https://api.yourdomain.com
   CORS_ORIGIN=https://yourdomain.com
   ```

---

## 7. User Flow Diagram

### New User Registration via OAuth

```
User clicks "Login with Google/GitHub"
         ↓
Redirected to OAuth provider
         ↓
User approves permissions
         ↓
Redirected to /callback with auth code
         ↓
Backend exchanges code for user info
         ↓
Backend checks if user exists
         ↓
    [Does NOT exist]
         ↓
Backend creates new user account
         ↓
User automatically logged in
```

### Existing User Login

```
User clicks "Login with Google/GitHub"
         ↓
OAuth provider authentication
         ↓
Backend finds existing user by OAuth ID
         ↓
User logged in
```

### Linking OAuth to Existing Account

```
User already has local account
         ↓
User initiates OAuth login
         ↓
Backend finds existing user by email
         ↓
Backend links OAuth provider to account
         ↓
User logged in with linked account
```

---

## 8. Testing OAuth Locally

### Test with ngrok (Recommended)

Since OAuth providers require public URLs, use ngrok for local testing:

1. Install ngrok: `npm install -g ngrok`
2. Start your backend: `npm run dev`
3. In a new terminal: `ngrok http 5000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update OAuth app callback URLs to use ngrok URL:
   - Google: `https://abc123.ngrok.io/api/v1/auth/google/callback`
   - GitHub: `https://abc123.ngrok.io/api/v1/auth/github/callback`
6. Update `.env`:
   ```env
   BASE_URL=https://abc123.ngrok.io
   ```

### Test Flow

1. Open ngrok URL in browser
2. Navigate to `/api/v1/auth/google` or `/api/v1/auth/github`
3. Complete OAuth flow
4. Verify redirect with tokens

---

## 9. Troubleshooting

### Common Issues

**Error: `redirect_uri_mismatch`**
- Solution: Ensure callback URL in OAuth app matches exactly (including protocol and path)

**Error: `No email provided by OAuth provider`**
- Solution: Ensure email scope is requested and user grants permission

**Error: `Cannot unlink OAuth account`**
- Solution: User must set a password before unlinking if OAuth is only auth method

**Error: `CORS error during OAuth callback`**
- Solution: Ensure backend domain is in CORS_ORIGIN whitelist

---

## 10. Database Schema

Users created via OAuth have these additional fields:

```javascript
{
  email: "user@example.com",
  username: "user_1234567890", // Auto-generated
  authProvider: "google", // or "github"
  isEmailVerified: true, // Auto-verified for OAuth
  oauth: {
    google: {
      id: "google-user-id",
      email: "user@example.com",
      displayName: "John Doe"
    },
    github: {
      id: "github-user-id",
      username: "johndoe",
      profileUrl: "https://github.com/johndoe"
    }
  }
}
```

---

## 11. API Documentation

All OAuth endpoints are documented in Swagger UI:
- URL: `http://localhost:5000/api/v1/docs`
- Tag: **OAuth**

---

## Support

For issues or questions:
1. Check the logs in `./logs` directory
2. Review Swagger documentation
3. Verify environment variables
4. Ensure MongoDB is running
5. Check OAuth app configuration in provider console

---

**Last Updated:** October 2024
