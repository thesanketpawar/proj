/**
 * Basic tests - used to generate coverage report for SonarQube analysis
 */
const {app} = require('./server');

// Mock mysql2 so tests don't need a real DB connection
jest.mock('mysql2', () => ({
  createPool: () => ({
    promise: () => ({
      query: jest.fn().mockResolvedValue([[{ id: 1, name: 'Test User', role: 'SDE', department: 'Engineering' }]])
    })
  })
}));

const app = require('./server');

describe('Backend API', () => {
  it('GET / should return status OK', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET /api/employees should return an array', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/employees without body should return 400', async () => {
    const res = await request(app).post('/api/employees').send({});
    expect(res.statusCode).toBe(400);
  });
});
afterAll(() => {
    jest.clearAllMocks();
});
