const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const bcrypt = require('bcryptjs');

describe('Auth Endpoints', () => {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    };

    describe('POST /api/auth/register', () => {
        it('should register a new user and return verification message', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(testUser);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Verification code sent');
            expect(res.body.email).toBe(testUser.email);
            
            const user = await User.findOne({ email: testUser.email });
            expect(user).toBeTruthy();
            expect(user.isVerified).toBe(false);
            expect(emailService.sendVerificationCode).toHaveBeenCalledWith(testUser.email, '1234');
        });

        it('should reject duplicate email', async () => {
            await request(app).post('/api/auth/register').send(testUser);
            const res = await request(app).post('/api/auth/register').send(testUser);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('User already exists');
        });

        it('should reject missing required fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'No Email' });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Please add all fields');
        });
    });

    describe('POST /api/auth/verify-code', () => {
        let user;
        
        beforeEach(async () => {
            const salt = await bcrypt.genSalt(10);
            const hashedCode = await bcrypt.hash('1234', salt);
            user = await User.create({
                ...testUser,
                password: 'hashedpassword',
                verificationCode: hashedCode,
                verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
                isVerified: false
            });
        });

        it('should verify correct code', async () => {
            const res = await request(app)
                .post('/api/auth/verify-code')
                .send({ email: testUser.email, code: '1234' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeTruthy();
            expect(res.body.refreshToken).toBeTruthy();
            expect(res.body.user.isVerified).toBe(true);
            
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.isVerified).toBe(true);
        });

        it('should reject expired code', async () => {
            user.verificationCodeExpiry = new Date(Date.now() - 1000);
            await user.save();
            
            const res = await request(app)
                .post('/api/auth/verify-code')
                .send({ email: testUser.email, code: '1234' });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Verification code expired');
        });

        it('should reject wrong code', async () => {
            const res = await request(app)
                .post('/api/auth/verify-code')
                .send({ email: testUser.email, code: '9999' });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid verification code');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(testUser.password, salt);
            await User.create({
                ...testUser,
                password: hashedPassword,
                isVerified: true
            });
        });

        it('should send verification code for valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: testUser.password });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Verification code sent');
            expect(emailService.sendLoginVerificationCode).toHaveBeenCalledWith(testUser.email, '1234');
        });

        it('should reject invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: 'wrongpassword' });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid credentials');
        });

        it('should reject non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nobody@example.com', password: 'password' });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid credentials');
        });
    });

    describe('POST /api/auth/verify-login', () => {
        beforeEach(async () => {
            const salt = await bcrypt.genSalt(10);
            const hashedCode = await bcrypt.hash('1234', salt);
            await User.create({
                ...testUser,
                password: 'hashedpassword',
                isVerified: true,
                loginVerificationCode: hashedCode,
                loginVerificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000)
            });
        });

        it('should verify login code and return JWT', async () => {
            const res = await request(app)
                .post('/api/auth/verify-login')
                .send({ email: testUser.email, code: '1234' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeTruthy();
            expect(res.body.refreshToken).toBeTruthy();
        });
    });

    describe('POST /api/auth/refresh-token', () => {
        let refreshToken;
        beforeEach(async () => {
            const jwt = require('jsonwebtoken');
            const userId = new require('mongoose').Types.ObjectId();
            refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
            await User.create({
                ...testUser,
                _id: userId,
                password: 'hashedpassword',
                isVerified: true,
                refreshToken: refreshToken
            });
        });

        it('should issue new tokens', async () => {
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeTruthy();
            expect(res.body.refreshToken).toBeTruthy();
            expect(res.body.refreshToken).not.toBe(refreshToken);
        });
    });

    describe('POST /api/auth/resend-code', () => {
        beforeEach(async () => {
            await User.create({
                ...testUser,
                password: 'hashedpassword',
                isVerified: false
            });
        });

        it('should resend verification code', async () => {
            const res = await request(app)
                .post('/api/auth/resend-code')
                .send({ email: testUser.email, type: 'register' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Code resent');
            expect(emailService.sendVerificationCode).toHaveBeenCalledWith(testUser.email, '1234');
        });
    });
});
