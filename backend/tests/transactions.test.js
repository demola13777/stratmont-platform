const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');

describe('Transaction Endpoints', () => {
    let token;
    let user;
    const planId = new require('mongoose').Types.ObjectId();

    beforeEach(async () => {
        user = await User.create({
            name: 'Tx User',
            email: 'tx@example.com',
            password: 'hashedpassword',
            isVerified: true,
            balances: {
                totalDeposit: 1000,
                availableBalance: 500,
                totalEarned: 500
            },
            cycleStatus: 'completed'
        });
        token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    const authHeader = () => ['Authorization', `Bearer ${token}`];

    describe('POST /api/transactions/deposit', () => {
        it('should create pending deposit with valid data', async () => {
            const res = await request(app)
                .post('/api/transactions/deposit')
                .set(...authHeader())
                .send({
                    amount: 500,
                    planId: planId.toString(),
                    walletAddressUsed: 'bc1qtest123'
                });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.message).toMatch(/submitted successfully/);
            
            const tx = await Transaction.findOne({ user: user._id, type: 'deposit' });
            expect(tx).toBeTruthy();
            expect(tx.status).toBe('pending');
            expect(tx.amount).toBe(500);
        });

        it('should reject missing required fields', async () => {
            const res = await request(app)
                .post('/api/transactions/deposit')
                .set(...authHeader())
                .send({ amount: 500 });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/required/);
        });
    });

    describe('POST /api/transactions/withdraw', () => {
        it('should create pending withdrawal', async () => {
            const res = await request(app)
                .post('/api/transactions/withdraw')
                .set(...authHeader())
                .send({
                    amount: 100,
                    walletAddress: '0xtest123'
                });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.message).toMatch(/submitted successfully/);
            
            const tx = await Transaction.findOne({ user: user._id, type: 'withdrawal' });
            expect(tx).toBeTruthy();
            expect(tx.status).toBe('pending');
            expect(tx.amount).toBe(100);
            
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.balances.availableBalance).toBe(400); // 500 - 100
        });

        it('should reject withdrawal exceeding balance', async () => {
            const res = await request(app)
                .post('/api/transactions/withdraw')
                .set(...authHeader())
                .send({
                    amount: 1000,
                    walletAddress: '0xtest123'
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Insufficient available balance.');
        });
    });

    describe('POST /api/transactions/reinvest', () => {
        it('should reinvest full balance', async () => {
            const res = await request(app)
                .post('/api/transactions/reinvest')
                .set(...authHeader())
                .send({}); // full balance
            
            expect(res.statusCode).toBe(200);
            
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.balances.availableBalance).toBe(0);
            expect(updatedUser.balances.totalDeposit).toBe(1500);
            expect(updatedUser.cycleStatus).toBe('active');
            
            const tx = await Transaction.findOne({ user: user._id, type: 'reinvestment' });
            expect(tx).toBeTruthy();
            expect(tx.amount).toBe(500);
        });

        it('should reinvest partial amount', async () => {
            const res = await request(app)
                .post('/api/transactions/reinvest')
                .set(...authHeader())
                .send({ amount: 200 });
            
            expect(res.statusCode).toBe(200);
            
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.balances.availableBalance).toBe(300); // 500 - 200
            expect(updatedUser.balances.totalDeposit).toBe(1200);
        });
    });

    describe('GET /api/transactions/my', () => {
        beforeEach(async () => {
            await Transaction.create({
                user: user._id,
                type: 'deposit',
                amount: 300,
                status: 'approved'
            });
            await Transaction.create({
                user: user._id,
                type: 'withdrawal',
                amount: 100,
                status: 'pending'
            });
        });

        it('should return user\'s transactions', async () => {
            const res = await request(app)
                .get('/api/transactions/my')
                .set(...authHeader());
            
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
        });
    });
});
