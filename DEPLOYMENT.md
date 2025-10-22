# Production Deployment Guide

Complete guide for deploying Nexus UI Backend to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Methods](#deployment-methods)
- [Docker Deployment](#docker-deployment)
- [PM2 Deployment](#pm2-deployment)
- [Cloud Platforms](#cloud-platforms)
- [Environment Configuration](#environment-configuration)
- [SSL/TLS Setup](#ssltls-setup)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- Node.js 20+ (LTS)
- Docker 24+ and Docker Compose
- MongoDB 7.0+
- Redis 7+
- ClamAV (for malware scanning)
- Nginx (for reverse proxy)

### System Requirements

**Minimum:**
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space
- Ubuntu 22.04 LTS / Amazon Linux 2023

**Recommended:**
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB SSD
- Load balancer for HA

## Deployment Methods

### 1. Docker Deployment (Recommended)

**Advantages:**
- ✅ Consistent environment
- ✅ Easy scaling
- ✅ Built-in health checks
- ✅ Simple rollbacks

**Quick Start:**

```bash
# Clone repository
git clone https://github.com/yourorg/nexus-ui-backend.git
cd nexus-ui-backend

# Copy and configure environment
cp .env.production.example .env
nano .env  # Edit with your production values

# Build and start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f backend
```

### 2. PM2 Deployment

**Advantages:**
- ✅ Process clustering
- ✅ Auto-restart on crashes
- ✅ Zero-downtime reload
- ✅ Built-in monitoring

**Quick Start:**

```bash
# Install PM2 globally
npm install -g pm2

# Install dependencies
npm ci --only=production

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### 3. Kubernetes

See `kubernetes/` directory for manifests.

## Docker Deployment

### Production Setup

**1. Prepare Environment**

```bash
# Create directory structure
mkdir -p ~/nexus-backend
cd ~/nexus-backend

# Copy files
cp .env.production.example .env
```

**2. Configure Environment**

Edit `.env`:

```env
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
MONGODB_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)
```

**3. Generate SSL Certificates**

```bash
# Using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d api.yourdomain.com

# Copy certificates
mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem docker/ssl/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem docker/ssl/
```

**4. Start Services**

```bash
# Build and start
docker-compose up -d

# Verify health
curl http://localhost:5000/api/v1/health
```

**5. Check Logs**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mongodb
```

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend

# Execute commands in container
docker-compose exec backend sh

# Update and rebuild
git pull
docker-compose build --no-cache
docker-compose up -d

# Database backup
docker-compose exec mongodb mongodump --out /data/backup
```

## PM2 Deployment

### Server Setup

**1. Install Dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Redis
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Install ClamAV
sudo apt install -y clamav clamav-daemon
sudo freshclam
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon
```

**2. Deploy Application**

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/yourorg/nexus-ui-backend.git
cd nexus-ui-backend

# Install dependencies
npm ci --only=production

# Configure environment
cp .env.production.example .env
nano .env  # Edit production values

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Configure PM2 to start on boot
pm2 startup
# Run the command it outputs
```

**3. Configure Nginx**

```bash
sudo nano /etc/nginx/sites-available/nexus-backend
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nexus-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Stop application
pm2 stop nexus-backend

# Restart (zero-downtime)
pm2 reload nexus-backend

# View logs
pm2 logs nexus-backend

# Monitor
pm2 monit

# List processes
pm2 list

# Process info
pm2 show nexus-backend

# Update application
git pull
npm ci --only=production
pm2 reload nexus-backend
```

## Cloud Platforms

### AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js-20 nexus-backend

# Create environment
eb create production

# Deploy
eb deploy
```

### AWS ECS (Docker)

See `aws/ecs-task-definition.json`

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/nexus-backend

# Deploy
gcloud run deploy nexus-backend \
  --image gcr.io/PROJECT_ID/nexus-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Heroku

```bash
# Login
heroku login

# Create app
heroku create nexus-backend

# Add buildpack
heroku buildpacks:set heroku/nodejs

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main
```

### DigitalOcean App Platform

Upload `docker-compose.yml` via web interface or use `doctl`.

## Environment Configuration

### Generate Secure Secrets

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (exactly 32 characters)
openssl rand -base64 24

# Session Secret
openssl rand -base64 32

# MongoDB Password
openssl rand -base64 24

# Redis Password
openssl rand -base64 24
```

### Required Environment Variables

```env
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
JWT_REFRESH_SECRET=your-secure-refresh-secret
SESSION_SECRET=your-secure-session-secret
CSRF_SECRET=your-secure-csrf-secret
ENCRYPTION_KEY=your-32-character-encryption-key
MONGODB_URI=mongodb://user:pass@host:27017/db
REDIS_HOST=redis-host
REDIS_PASSWORD=redis-password
```

## SSL/TLS Setup

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Manual SSL

```bash
# Generate self-signed (development only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem

# Copy to nginx
sudo cp fullchain.pem /etc/nginx/ssl/
sudo cp privkey.pem /etc/nginx/ssl/
```

## Monitoring

### Health Checks

```bash
# Application health
curl http://localhost:5000/api/v1/health

# MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Redis
docker-compose exec redis redis-cli ping

# ClamAV
docker-compose exec backend sh -c 'clamdscan --ping'
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard
pm2 install pm2-server-monit
pm2 web

# PM2 Plus (cloud monitoring)
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

### Application Logs

```bash
# Docker
docker-compose logs -f --tail=100 backend

# PM2
pm2 logs nexus-backend --lines 100

# Files
tail -f logs/combined.log
tail -f logs/error.log
```

## Scaling

### Horizontal Scaling (Docker)

```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# With load balancer
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d
```

### Horizontal Scaling (PM2)

```bash
# Use all CPU cores
pm2 start ecosystem.config.js --env production -i max

# Specific number of instances
pm2 scale nexus-backend 4
```

### Vertical Scaling

Update `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Backup & Recovery

### MongoDB Backup

```bash
# Manual backup
docker-compose exec mongodb mongodump --out /data/backup

# Scheduled backup (cron)
0 2 * * * docker-compose exec mongodb mongodump --out /data/backup/$(date +\%Y\%m\%d)
```

### Restore

```bash
# Restore from backup
docker-compose exec mongodb mongorestore /data/backup/20241020
```

## Security Checklist

- [ ] All secrets changed from defaults
- [ ] SSL/TLS certificates installed
- [ ] Firewall configured (ports 80, 443 only)
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] Environment variables secured
- [ ] ClamAV virus definitions updated
- [ ] Nginx security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Logs rotation configured
- [ ] Backups automated
- [ ] Monitoring alerts setup

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs backend
pm2 logs nexus-backend

# Verify environment
docker-compose exec backend env

# Check port availability
sudo netstat -tulpn | grep 5000
```

### Database Connection Issues

```bash
# Test MongoDB connection
docker-compose exec backend sh
mongosh $MONGODB_URI

# Check MongoDB logs
docker-compose logs mongodb
```

### High Memory Usage

```bash
# Check memory
docker stats
pm2 monit

# Restart application
pm2 reload nexus-backend --update-env
```

### Performance Issues

```bash
# Check CPU/Memory
htop

# Check disk I/O
iostat -x 1

# Optimize MongoDB
docker-compose exec mongodb mongosh
> db.users.getIndexes()
```

## Support

- Documentation: `/docs`
- Issues: https://github.com/yourorg/nexus-ui-backend/issues
- Email: support@yourdomain.com

---

**Last Updated**: October 2024
**Version**: 1.0.0
