const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');

describe('Admin Endpoints', () => {
    let adminToken;
    let userToken;
    let admin;
    let normalUser;

    beforeEach(async () => {
        admin = await User.create({
            name: 'Admin',
            email: 'admin@example.com',
            password: 'hashedpassword',
            role: 'admin',
            isVerified: true
        });
        adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        normalUser = await User.create({
            name: 'Normal User',
            email: 'user@example.com',
            password: 'hashedpassword',
            role: 'user',
            isVerified: true,
            balances: {
                totalDeposit: 0,
                availableBalance: 0
            }
        });
        userToken = jwt.sign({ id: normalUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    const adminAuthHeader = () => ['Authorization', `Bearer ${adminToken}`];
    const userAuthHeader = () => ['Authorization', `Bearer ${userToken}`];

    describe('GET /api/admin/stats', () => {
        it('should return dashboard stats for admin', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set(...adminAuthHeader());
            
            expect(res.statusCode).toBe(200);
            expect(res.body.totalUsers).toBeDefined();
            expect(res.body.totalApprovedDeposits).toBeDefined();
            expect(res.body.pendingDeposits).toBeDefined();
        });

        it('should reject non-admin users', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set(...userAuthHeader());
            
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/Admins only/);
        });
    });

    describe('GET /api/admin/users', () => {
        it('should return paginated users', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set(...adminAuthHeader());
            
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.data.length).toBeGreaterThanOrEqual(2); // admin + normalUser
        });
    });

    describe('GET /api/admin/transactions', () => {
        beforeEach(async () => {
            await Transaction.create({
                user: normalUser._id,
                type: 'deposit',
                amount: 500,
                status: 'pending'
            });
        });

        it('should return paginated transactions with filters', async () => {
            const res = await request(app)
                .get('/api/admin/transactions?status=pending')
                .set(...adminAuthHeader());
            
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].status).toBe('pending');
        });
    });

    describe('PUT /api/admin/transactions/:id', () => {
        let depositTx;
        let withdrawalTx;
        const planId = new require('mongoose').Types.ObjectId();

        beforeEach(async () => {
            depositTx = await Transaction.create({
                user: normalUser._id,
                type: 'deposit',
                amount: 1000,
                status: 'pending',
                plan: planId
            });

            withdrawalTx = await Transaction.create({
                user: normalUser._id,
                type: 'withdrawal',
                amount: 200,
                status: 'pending'
            });
        });

        it('should approve a pending deposit', async () => {
            const res = await request(app)
                .put(`/api/admin/transactions/${depositTx._id}`)
                .set(...adminAuthHeader())
                .send({ status: 'approved' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.transaction.status).toBe('approved');

            const updatedUser = await User.findById(normalUser._id);
            expect(updatedUser.balances.totalDeposit).toBe(1000);
            expect(updatedUser.balances.availableBalance).toBe(1000);
            expect(updatedUser.cycleStatus).toBe('active');
        });

        it('should reject a pending deposit', async () => {
            const res = await request(app)
                .put(`/api/admin/transactions/${depositTx._id}`)
                .set(...adminAuthHeader())
                .send({ status: 'rejected' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.transaction.status).toBe('rejected');

            const updatedUser = await User.findById(normalUser._id);
            expect(updatedUser.balances.totalDeposit).toBe(0); // unchanged
        });

        it('should refund available balance if withdrawal is rejected', async () => {
            // first deduct balance manually as if user requested withdrawal
            normalUser.balances.availableBalance = 300;
            await normalUser.save();

            const res = await request(app)
                .put(`/api/admin/transactions/${withdrawalTx._id}`)
                .set(...adminAuthHeader())
                .send({ status: 'rejected' });
            
            expect(res.statusCode).toBe(200);
            
            const updatedUser = await User.findById(normalUser._id);
            expect(updatedUser.balances.availableBalance).toBe(500); // 300 + 200
        });
    });
});
