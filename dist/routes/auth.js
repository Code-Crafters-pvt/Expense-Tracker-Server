"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const axios_1 = __importDefault(require("axios"));
const google_auth_library_1 = require("google-auth-library");
const router = express_1.default.Router();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
const validateRegistration = [
    (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
];
const validateLogin = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
];
router.post('/register', validateRegistration, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { name, email, password } = req.body;
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        const user = new User_1.User({
            name,
            email,
            password
        });
        await user.save();
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user._id.toString(),
            email: user.email
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user._id.toString(),
            email: user.email
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                },
                accessToken,
                refreshToken
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
});
router.post('/login', validateLogin, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user._id.toString(),
            email: user.email
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user._id.toString(),
            email: user.email
        });
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                },
                accessToken,
                refreshToken
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }
        const decoded = require('jsonwebtoken').verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }
        const newAccessToken = (0, jwt_1.generateAccessToken)({
            userId: user._id.toString(),
            email: user.email
        });
        const newRefreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user._id.toString(),
            email: user.email
        });
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
        });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user
            }
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
router.post('/oauth', async (req, res) => {
    try {
        const { provider, token, name, email } = req.body;
        let userData = null;
        switch (provider) {
            case 'google':
                try {
                    const ticket = await googleClient.verifyIdToken({
                        idToken: token,
                        audience: process.env.GOOGLE_CLIENT_ID,
                    });
                    const payload = ticket.getPayload();
                    if (!payload)
                        throw new Error('Invalid Google token');
                    userData = {
                        name: payload.name || '',
                        email: payload.email || '',
                    };
                }
                catch (error) {
                    throw new Error('Failed to verify Google token');
                }
                break;
            case 'facebook':
                try {
                    const response = await axios_1.default.get(`https://graph.facebook.com/me?fields=name,email&access_token=${token}`);
                    userData = {
                        name: response.data.name,
                        email: response.data.email,
                    };
                }
                catch (error) {
                    throw new Error('Failed to verify Facebook token');
                }
                break;
            case 'apple':
                userData = {
                    name: name || '',
                    email: email || '',
                };
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid OAuth provider',
                });
        }
        if (!userData || !userData.email) {
            return res.status(400).json({
                success: false,
                error: 'Could not get user email from OAuth provider',
            });
        }
        let user = await User_1.User.findOne({ email: userData.email });
        if (!user) {
            user = new User_1.User({
                name: userData.name,
                email: userData.email,
                password: Math.random().toString(36).slice(-8),
            });
            await user.save();
        }
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user._id.toString(),
            email: user.email,
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user._id.toString(),
            email: user.email,
        });
        res.json({
            success: true,
            message: 'OAuth login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                },
                accessToken,
                refreshToken,
            },
        });
    }
    catch (error) {
        console.error('OAuth login error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'OAuth login failed',
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map