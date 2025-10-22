# Security Automation

Automated security updates, dependency management, and continuous security scanning.

## Overview

- **Dependabot**: Automated dependency updates
- **GitHub Actions**: CI/CD with security scanning
- **npm audit**: Vulnerability detection
- **Snyk**: Comprehensive security scanning
- **CodeQL**: Code security analysis
- **Docker scanning**: Container vulnerability detection

## Dependabot

### What is Dependabot?

GitHub's automated dependency update service that:
- Monitors dependencies for security vulnerabilities
- Creates pull requests for updates
- Groups related dependencies
- Follows semantic versioning

### Configuration

Located in `.github/dependabot.yml`

**Features:**
- ✅ Weekly automated updates (Mondays at 9 AM)
- ✅ Grouped dependency updates (security, database, dev)
- ✅ Auto-labeling and assignment
- ✅ Docker image updates
- ✅ GitHub Actions updates

**Update Schedule:**
- npm dependencies: Weekly (Monday 9:00 AM)
- Docker dependencies: Weekly (Monday 10:00 AM)
- GitHub Actions: Weekly

### Managing Dependabot PRs

**Auto-merge safe updates:**

```bash
# Enable auto-merge for patch updates
gh pr merge --auto --merge <pr-number>
```

**Review process:**
1. Dependabot creates PR with changelog
2. CI/CD runs tests automatically
3. Review security impact
4. Merge if tests pass

**Ignoring dependencies:**

Add to `.github/dependabot.yml`:

```yaml
ignore:
  - dependency-name: "package-name"
    update-types: ["version-update:semver-major"]
```

## GitHub Actions Workflows

### CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

**Jobs:**
1. **Lint** - ESLint and Prettier
2. **Test** - Unit and integration tests
3. **Build** - Docker image creation
4. **Deploy Staging** - Auto-deploy develop branch
5. **Deploy Production** - Auto-deploy main branch

**Triggers:**
- Push to main/develop
- Pull requests
- Manual dispatch

### Security Scanning

**File**: `.github/workflows/security-scan.yml`

**Scans:**

1. **Dependency Vulnerabilities**
   - npm audit
   - Snyk scan
   - OWASP Dependency Check

2. **Secret Detection**
   - TruffleHog
   - GitLeaks

3. **Code Analysis**
   - CodeQL (SAST)
   - ESLint security rules

4. **Docker Security**
   - Trivy scanner
   - Snyk Container

**Schedule**: Daily at 2 AM UTC

## Security Tools

### 1. npm audit

**Built-in Node.js security scanner**

```bash
# Run audit
npm audit

# Fix automatically (careful!)
npm audit fix

# Check specific severity
npm audit --audit-level=moderate
```

**In CI/CD:**
```yaml
- name: Run npm audit
  run: npm audit --audit-level=moderate
```

### 2. Snyk

**Comprehensive security platform**

**Setup:**

1. Sign up at https://snyk.io
2. Get API token
3. Add to GitHub Secrets as `SNYK_TOKEN`

**Local usage:**

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor

# Test Docker image
snyk container test nexus-backend:latest
```

**Features:**
- Dependency vulnerabilities
- License compliance
- Container scanning
- IaC scanning
- Code analysis

### 3. CodeQL

**GitHub's semantic code analysis**

**Detects:**
- SQL injection
- XSS vulnerabilities
- Command injection
- Path traversal
- Hardcoded credentials
- Insecure cryptography

**Enabled automatically** in `.github/workflows/security-scan.yml`

### 4. Trivy

**Container vulnerability scanner**

```bash
# Scan Docker image
trivy image nexus-backend:latest

# Scan specific severities
trivy image --severity HIGH,CRITICAL nexus-backend:latest

# Output as JSON
trivy image -f json nexus-backend:latest
```

### 5. OWASP Dependency Check

**Identifies known vulnerabilities**

```bash
# Run locally
docker run --rm -v $(pwd):/src \
  owasp/dependency-check --scan /src \
  --format HTML --out /src/reports
```

### 6. TruffleHog & GitLeaks

**Secret detection**

Scans for:
- API keys
- Passwords
- Private keys
- Access tokens
- Database credentials

## Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
SNYK_TOKEN           # Snyk API token
DOCKER_USERNAME      # Docker Hub username
DOCKER_PASSWORD      # Docker Hub password
CODECOV_TOKEN        # Code coverage token (optional)
SENTRY_DSN           # Sentry DSN (optional)
```

## Automated Workflows

### On Every Push/PR

✅ Linting
✅ Tests
✅ Security scanning
✅ Build verification

### Daily (2 AM UTC)

✅ Full security scan
✅ Dependency audit
✅ Container scanning
✅ Secret detection

### Weekly (Monday 9 AM)

✅ Dependency updates (Dependabot)
✅ Docker image updates
✅ GitHub Actions updates

## Security Alerts

### GitHub Security Advisories

**Location**: GitHub → Security tab

**Features:**
- Dependabot alerts
- Code scanning alerts
- Secret scanning alerts

**Notifications:**
- Email
- Web
- Mobile

### Vulnerability Response

**Process:**

1. **Alert received** (GitHub/Snyk/Email)
2. **Assess severity** (Critical/High/Medium/Low)
3. **Review Dependabot PR** or create manual fix
4. **Test fix** (CI/CD runs automatically)
5. **Deploy** (staging → production)
6. **Document** incident

**SLA:**
- Critical: 24 hours
- High: 1 week
- Medium: 1 month
- Low: Next sprint

## Best Practices

### 1. Keep Dependencies Updated

```bash
# Check outdated packages
npm outdated

# Update to latest safe versions
npm update

# Check for major updates
npx npm-check-updates
```

### 2. Review Security Advisories

Weekly review:
- GitHub Security tab
- npm audit report
- Snyk dashboard
- Dependabot PRs

### 3. Pin Dependencies

**Production:**
```json
{
  "dependencies": {
    "express": "5.1.0"  // Exact version
  }
}
```

**Development:**
```json
{
  "devDependencies": {
    "jest": "^30.0.0"  // Allow minor/patch
  }
}
```

### 4. Use Lock Files

Always commit `package-lock.json`:
- Ensures consistent installs
- Security audit reference
- Dependency tree tracking

### 5. Audit Before Deploy

```bash
# Pre-deployment checklist
npm audit --production
npm test
npm run lint
docker scan nexus-backend:latest
```

### 6. Monitor Production

- Enable Sentry error tracking
- Set up uptime monitoring
- Configure log aggregation
- Monitor metrics (Prometheus/Grafana)

## Emergency Response

### Critical Vulnerability Found

**Immediate actions:**

1. **Assess impact**
   ```bash
   npm audit
   npm ls <vulnerable-package>
   ```

2. **Isolate if needed**
   - Disable affected feature
   - Apply rate limiting
   - Enable additional monitoring

3. **Apply fix**
   ```bash
   npm update <package>
   # OR
   npm install <package>@<safe-version>
   ```

4. **Test thoroughly**
   ```bash
   npm test
   npm run test:security
   ```

5. **Deploy emergency hotfix**
   ```bash
   git checkout -b hotfix/security-patch
   # Make changes
   git commit -m "fix: patch critical vulnerability CVE-XXXX-XXXX"
   git push
   # Create PR, get approval, merge, deploy
   ```

6. **Notify stakeholders**
   - Security team
   - Operations
   - Management

### Compromised Secrets

**If secrets are leaked:**

1. **Revoke immediately**
   - API keys
   - Access tokens
   - Database passwords

2. **Rotate credentials**
   ```bash
   # Generate new secrets
   npm run secrets:generate
   ```

3. **Update environment**
   - Update .env files
   - Update CI/CD secrets
   - Update production config

4. **Audit access logs**
   - Check for unauthorized access
   - Review recent API calls
   - Examine audit logs

## Compliance

### OWASP Top 10

All scans check for:
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable Components
- A07: Authentication Failures
- A08: Software and Data Integrity
- A09: Logging Failures
- A10: Server-Side Request Forgery

### CIS Benchmarks

Security configurations aligned with:
- CIS Docker Benchmark
- CIS Kubernetes Benchmark
- CIS Ubuntu Benchmark

### SOC 2 / ISO 27001

Automated controls for:
- Access control
- Change management
- Vulnerability management
- Incident response
- Continuous monitoring

## Resources

- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [Snyk Documentation](https://docs.snyk.io/)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Trivy](https://aquasecurity.github.io/trivy/)
- [npm Audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

**Last Updated**: October 2024
**Version**: 1.0.0
