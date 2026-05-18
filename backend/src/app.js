const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { globalLimit, redeemLimit, authLimit } = require('./middleware/rateLimiter');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const authController = require('./controllers/authController');
const rewardsController = require('./controllers/rewardsController');
const adminController = require('./controllers/adminController');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware Headers
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// CORS config
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Logger
app.use(morgan('dev'));

// Global rate limit
app.use(globalLimit);

// ── ENDPOINTS MOUNTING ──

// 🌐 Visitor Analytics Capturer
app.get('/api/visitor', authController.captureVisitor);

// 🔑 Discord OAuth Callback endpoint
app.get('/api/auth/callback', authLimit, authController.handleDiscordCallback);

// 🎁 Rewards Stock Catalog
app.get('/api/rewards/catalog', rewardsController.getRewardsCatalog);

// 🎟️ Redeem Reward form submittals (3 claims/min limit)
app.post('/api/rewards/redeem', authenticateToken, redeemLimit, rewardsController.redeemReward);

// 🛡️ Admin Root Controls
app.post('/api/admin/generate-code', authenticateToken, authorizeRoles('ADMIN'), adminController.generateRedeemCode);
app.get('/api/admin/visitor-logs', authenticateToken, authorizeRoles('ADMIN', 'MODERATOR'), adminController.getVisitorLogs);
app.get('/api/admin/audit-logs', authenticateToken, authorizeRoles('ADMIN'), adminController.getAuditLogs);

// System Status Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Boot listening server
app.listen(PORT, () => {
  console.log(`🚀 Cyber Gateway Online. Listening on PORT ${PORT}`);
});
