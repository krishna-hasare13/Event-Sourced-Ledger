const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const requestIdMiddleware = require('./middleware/requestId');
const { authLimiter, transactionLimiter } = require('./middleware/rateLimiters');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/docs', (req, res) => {
	res.type('text/yaml').sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/accounts', authMiddleware, require('./routes/accounts'));
app.use('/api/transactions', authLimiter, transactionLimiter, authMiddleware, require('./routes/transactions'));

app.use(errorHandler); // must be last

const PORT = process.env.PORT || 4000;

if (require.main === module) {
	app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

module.exports = app;