process.env.JWT_SECRET = 'test_secret_key';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'admin_password_123';

const test = require('node:test');
const assert = require('node:assert');
const { pool } = require('../db');
const authController = require('../controllers/authController');
const servicesController = require('../controllers/servicesController');
const applicationController = require('../controllers/applicationController');

// Helper to mock request and response
function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// Override pool.query dynamically
let mockQueryFn = async () => ({ rows: [] });
pool.query = async (text, params) => {
  return mockQueryFn(text, params);
};

test.describe('Auth Controller Tests', () => {
  test.it('register: should register a user successfully when input is valid', async () => {
    mockQueryFn = async (text, params) => {
      if (text.includes('SELECT * FROM users')) {
        return { rows: [] }; // No existing user
      }
      return { rows: [] };
    };

    const req = {
      body: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      },
    };
    const res = mockResponse();

    await authController.register(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.message, 'Registration successful');
  });

  test.it('register: should fail if user already exists', async () => {
    mockQueryFn = async (text, params) => {
      if (text.includes('SELECT * FROM users')) {
        return { rows: [{ id: '123', email: 'test@example.com' }] };
      }
      return { rows: [] };
    };

    const req = {
      body: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      },
    };
    const res = mockResponse();

    await authController.register(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'User already exists');
  });

  test.it('register: should fail if required fields are missing', async () => {
    const req = {
      body: {
        fullName: '',
        email: 'test@example.com',
        password: '',
      },
    };
    const res = mockResponse();

    await authController.register(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'All fields required');
  });

  test.it('login: should log in successfully with valid credentials', async () => {
    mockQueryFn = async (text, params) => {
      return { rows: [{ id: '123', email: 'test@example.com', full_name: 'Test User' }] };
    };

    const req = {
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    };
    const res = mockResponse();

    await authController.login(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.message, 'Login successful');
  });

  test.it('login: should fail with invalid credentials', async () => {
    mockQueryFn = async (text, params) => {
      return { rows: [] };
    };

    const req = {
      body: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    };
    const res = mockResponse();

    await authController.login(req, res);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.message, 'Invalid credentials');
  });

  test.it('adminLogin: should log in successfully with valid admin credentials', async () => {
    const req = {
      body: {
        email: 'admin@test.com',
        password: 'admin_password_123',
      },
    };
    const res = mockResponse();

    await authController.adminLogin(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.message, 'Admin login successful');
  });
});

test.describe('Services Controller Tests', () => {
  test.it('getAllServices: should return list of services from database', async () => {
    const mockServices = [
      { id: 'srv_001', name: 'Service A', description: 'Desc A', processingTime: '5 days', fee: '100' }
    ];
    mockQueryFn = async (text, params) => {
      return { rows: mockServices };
    };

    const req = {};
    const res = mockResponse();

    await servicesController.getAllServices(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, mockServices);
  });

  test.it('getAllServices: should return fallback static services if query fails', async () => {
    mockQueryFn = async (text, params) => {
      throw new Error('Database connection failed');
    };

    const req = {};
    const res = mockResponse();

    await servicesController.getAllServices(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 6); // fallback list length
    assert.strictEqual(res.body[0].id, 'srv_001');
  });
});

test.describe('Applications Controller Tests', () => {
  test.it('submitApplication: should successfully submit a new application', async () => {
    const mockCreatedApp = {
      id: 'APP-12345678',
      full_name: 'Applicant Name',
      cnic: '12345-6789012-3',
      service_type: 'srv_001',
      status: 'Pending',
    };

    mockQueryFn = async (text, params) => {
      if (text.includes('SELECT * FROM applications')) {
        return { rows: [mockCreatedApp] };
      }
      return { rows: [] }; // INSERT
    };

    const req = {
      body: {
        fullName: 'Applicant Name',
        cnic: '12345-6789012-3',
        phone: '03001234567',
        email: 'applicant@example.com',
        serviceType: 'srv_001',
        district: 'Mardan',
        additionalNotes: 'Urgent request',
      },
    };
    const res = mockResponse();

    await applicationController.submitApplication(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.deepStrictEqual(res.body, mockCreatedApp);
  });

  test.it('submitApplication: should fail if CNIC or service type is missing', async () => {
    const req = {
      body: {
        fullName: 'Applicant Name',
        cnic: '',
        serviceType: '',
      },
    };
    const res = mockResponse();

    await applicationController.submitApplication(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'CNIC and Service Type are required');
  });

  test.it('getApplicationsByCnic: should return list of applications for a valid CNIC', async () => {
    const mockApps = [
      { id: 'APP-1', cnic: '12345-6789012-3', status: 'Pending' }
    ];
    mockQueryFn = async (text, params) => {
      return { rows: mockApps };
    };

    const req = {
      params: { cnic: '12345-6789012-3' },
    };
    const res = mockResponse();

    await applicationController.getApplicationsByCnic(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, mockApps);
  });

  test.it('getApplicationsByCnic: should return 404 if no applications found', async () => {
    mockQueryFn = async (text, params) => {
      return { rows: [] };
    };

    const req = {
      params: { cnic: '99999-9999999-9' },
    };
    const res = mockResponse();

    await applicationController.getApplicationsByCnic(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.message, 'No applications found for this CNIC or ID');
  });
});
