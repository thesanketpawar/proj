/**
 * Basic tests - used to generate coverage report for SonarQube analysis
 */

const request = require('supertest');


// Mock mysql2 so tests don't need real DB
jest.mock('mysql2', () => ({
    createPool: () => ({
        promise: () => ({
            query: jest.fn()
                .mockResolvedValue([
                    [
                        {
                            id: 1,
                            name: 'Test User',
                            role: 'SDE',
                            department: 'Engineering'
                        }
                    ]
                ])
        })
    })
}));


const { app } = require('./server');


describe('Backend API', () => {


    test('GET / should return status OK', async () => {

        const res = await request(app)
            .get('/');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('OK');

    });



    test('GET /api/employees should return an array', async () => {

        const res = await request(app)
            .get('/api/employees');

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

    });



test('POST /api/employees without body should return 400', async () => {

    const res = await request(app)
        .post('/api/employees');

    expect(res.statusCode).toBe(400);

});


});


afterAll(() => {

    jest.restoreAllMocks();

});
