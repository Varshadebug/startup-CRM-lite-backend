// Test registration and health endpoints
async function runTests() {
  const baseURL = 'http://localhost:5000';
  
  console.log('1. Testing Health Endpoint: GET /api/health');
  try {
    const healthRes = await fetch(`${baseURL}/api/health`);
    const healthData = await healthRes.json();
    console.log('Health Status:', healthRes.status);
    console.log('Health Response:', healthData);
  } catch (err) {
    console.error('Health Check Error:', err.message);
  }

  console.log('\n2. Testing Registration Endpoint: POST /api/auth/register');
  try {
    const randomEmail = `testuser_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: randomEmail,
        password: 'password123'
      })
    });
    
    const regData = await regRes.text();
    console.log('Registration Status:', regRes.status);
    console.log('Registration Response:', regData);
  } catch (err) {
    console.error('Registration Error:', err.message);
  }
}

runTests();
