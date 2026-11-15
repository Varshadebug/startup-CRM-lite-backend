import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { userSchema } from './models/User.js';
import { leadSchema } from './models/Lead.js';
import { errorHandler } from './middleware/errorHandler.js';

console.log('=== RUNNING CRM BACKEND COMPREHENSIVE TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

async function runTestSuite() {
  // Test 1: User Model Validation & Password Hashing
  console.log('--- 1. User Model & Schema Testing ---');
  const UserModel = mongoose.model('TestUser', userSchema);
  
  const validUser = new UserModel({
    name: 'Varsha M',
    email: 'varsha@example.com',
    password: 'password123'
  });
  
  const validationError = validUser.validateSync();
  assert(!validationError, 'Valid user schema passes validation');

  const invalidEmailUser = new UserModel({
    name: 'Invalid User',
    email: 'not-an-email',
    password: '123'
  });
  const invalidEmailErr = invalidEmailUser.validateSync();
  assert(
    invalidEmailErr?.errors?.email && invalidEmailErr?.errors?.password,
    'Invalid email and short password fail schema validation'
  );

  // Test toJSON removes password
  const jsonUser = validUser.toJSON();
  assert(!jsonUser.password, 'User.toJSON() strips password property');

  // Test bcrypt comparison
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('secretPassword', salt);
  const match = await bcrypt.compare('secretPassword', hashedPassword);
  const mismatch = await bcrypt.compare('wrongPassword', hashedPassword);
  assert(match === true && mismatch === false, 'bcrypt password comparison works accurately');

  // Test 2: JWT Generation & Verification
  console.log('\n--- 2. JWT Generation & Verification ---');
  const secret = 'test_jwt_secret_key_1234567890';
  const testUserId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign({ id: testUserId }, secret, { expiresIn: '1h' });
  const decoded = jwt.verify(token, secret);
  assert(decoded.id === testUserId, 'JWT correctly encodes and decodes user ID payload');

  // Test 3: Lead Model & Schema Validation
  console.log('\n--- 3. Lead Model & Schema Testing ---');
  const LeadModel = mongoose.model('TestLead', leadSchema);

  const validLead = new LeadModel({
    name: 'Acme Corp Contact',
    company: 'Acme Corp',
    email: 'contact@acme.com',
    phone: '+1-555-123-4567',
    status: 'Meeting Scheduled',
    source: 'LinkedIn',
    owner: new mongoose.Types.ObjectId()
  });
  const leadValErr = validLead.validateSync();
  assert(!leadValErr, 'Valid lead schema passes validation');

  const invalidLead = new LeadModel({
    name: 'A', // minLength 2
    company: '',
    email: 'bad-email',
    status: 'InvalidStatus',
    source: 'InvalidSource'
  });
  const invalidLeadErr = invalidLead.validateSync();
  assert(
    invalidLeadErr?.errors?.name &&
    invalidLeadErr?.errors?.company &&
    invalidLeadErr?.errors?.email &&
    invalidLeadErr?.errors?.status &&
    invalidLeadErr?.errors?.source &&
    invalidLeadErr?.errors?.owner,
    'Invalid lead fields (name, company, email, status, source, owner) caught by validation'
  );

  // Test virtual field 'age'
  validLead.createdAt = new Date(Date.now() - 3 * 24 * 3600 * 1000); // 3 days ago
  assert(validLead.age === 3, `Lead 'age' virtual correctly calculates elapsed days (${validLead.age} === 3)`);

  // Test 4: Error Handler Middleware Testing
  console.log('\n--- 4. Error Handler Middleware Testing ---');
  
  // Mock res object
  const createMockRes = () => {
    return {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };
  };

  // Test 4a: MongoDB duplicate key (11000)
  const res1 = createMockRes();
  errorHandler({ code: 11000, message: 'dup key' }, {}, res1, () => {});
  assert(res1.statusCode === 409 && res1.data.message === 'Email already exists', 'Error handler handles E11000 duplicate email with 409');

  // Test 4b: CORS error
  const res2 = createMockRes();
  errorHandler(new Error('Origin https://malicious.com not allowed by CORS'), {}, res2, () => {});
  assert(res2.statusCode === 403, 'Error handler handles CORS rejection with 403 Forbidden');

  // Test 4c: MongoDB connection / server selection timeout
  const res3 = createMockRes();
  errorHandler({ name: 'MongooseServerSelectionError', message: 'connection timeout' }, {}, res3, () => {});
  assert(res3.statusCode === 503, 'Error handler maps MongooseServerSelectionError to 503 Service Unavailable');

  // Test 4d: JWT invalid error
  const res4 = createMockRes();
  errorHandler({ name: 'JsonWebTokenError', message: 'invalid signature' }, {}, res4, () => {});
  assert(res4.statusCode === 401, 'Error handler maps JsonWebTokenError to 401 Unauthorized');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passedTests}/${totalTests} tests passed`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
