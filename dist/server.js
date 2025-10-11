"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const os_1 = __importDefault(require("os"));
const database_1 = require("./config/database");
const errorHandler_1 = require("./middleware/errorHandler");
const notFound_1 = require("./middleware/notFound");
const auth_1 = __importDefault(require("./routes/auth"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const categories_1 = __importDefault(require("./routes/categories"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const export_1 = __importDefault(require("./routes/export"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env['PORT'] || 3000;
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: process.env['CORS_ORIGIN']?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (process.env['NODE_ENV'] === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV']
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/expenses', expenses_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/export', export_1.default);
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
const getNetworkAddress = () => {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
            const { address, family, internal } = networkInterface;
            if (family === 'IPv4' && !internal) {
                return address;
            }
        }
    }
    return 'localhost';
};
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        console.log('✅ Connected to MongoDB');
        const networkAddress = getNetworkAddress();
        app.listen(PORT, () => {
            console.log('\n🚀 Server is running!');
            console.log('📱 Environment:', process.env['NODE_ENV']);
            console.log('🔗 Local URL: http://localhost:' + PORT);
            console.log('🌐 Network URL: http://' + networkAddress + ':' + PORT);
            console.log('💚 Health check: http://localhost:' + PORT + '/health');
            console.log('📋 API Base URL: http://' + networkAddress + ':' + PORT + '/api');
            console.log('\n📱 For mobile app, use this URL in your .env:');
            console.log('API_BASE_URL=http://' + networkAddress + ':' + PORT + '/api');
            console.log('\n' + '='.repeat(50) + '\n');
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});
startServer();
//# sourceMappingURL=server.js.map