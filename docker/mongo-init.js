// MongoDB initialization script
// Creates indexes and initial data

db = db.getSiblingDB('nexus_ui_db');

print('🔧 Initializing Nexus UI Database...');

// Create collections
db.createCollection('users');
db.createCollection('sessions');
db.createCollection('passwordhistories');
db.createCollection('securityevents');
db.createCollection('apikeys');

// Create indexes for users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });
db.users.createIndex({ createdAt: 1 });
db.users.createIndex({ 'security.accountLocked': 1 });

// Create indexes for sessions
db.sessions.createIndex({ sessionId: 1 }, { unique: true });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.sessions.createIndex({ 'device.fingerprint': 1 });

// Create indexes for password history
db.passwordhistories.createIndex({ userId: 1 });
db.passwordhistories.createIndex({ createdAt: 1 });
db.passwordhistories.createIndex({ userId: 1, createdAt: -1 });

// Create indexes for security events
db.securityevents.createIndex({ userId: 1 });
db.securityevents.createIndex({ eventType: 1 });
db.securityevents.createIndex({ timestamp: -1 });
db.securityevents.createIndex({ userId: 1, timestamp: -1 });
db.securityevents.createIndex({ 'metadata.ip': 1 });

// Create indexes for API keys
db.apikeys.createIndex({ hashedKey: 1 }, { unique: true });
db.apikeys.createIndex({ userId: 1 });
db.apikeys.createIndex({ isActive: 1 });
db.apikeys.createIndex({ expiresAt: 1 });

print('✅ Database initialized successfully');
print('✅ Indexes created');
