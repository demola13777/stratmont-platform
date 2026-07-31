const mongoose = require('mongoose');

jest.mock('../utils/emailService', () => ({
    generateCode: jest.fn(() => '1234'),
    sendVerificationCode: jest.fn(() => Promise.resolve(true)),
    sendLoginVerificationCode: jest.fn(() => Promise.resolve(true))
}));

beforeAll(async () => {
    // Set test env variables
    process.env.JWT_SECRET = 'test_jwt_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.NODE_ENV = 'test';
    
    const uri = 'mongodb://127.0.0.1:27017/stratmont_test_db_' + Date.now();
    await mongoose.connect(uri);
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
});

beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});
