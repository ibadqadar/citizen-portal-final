import http from 'k6/http';
import { sleep, check } from 'k6';

// k6 Options: Simulates traffic ramping up to 50 users to trigger the HPA
export const options = {
  stages: [
    { duration: '15s', target: 20 }, // Ramp up to 20 virtual users
    { duration: '30s', target: 50 }, // Ramp up to 50 virtual users (heavy load)
    { duration: '15s', target: 0 },  // Cool down back to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete under 500ms
  },
};

export default function () {
  // Target your frontend or backend API through the Ingress controller
  // By default, it hits the services API route of your Citizen Portal backend
  const url = 'http://localhost/api/services';
  
  const res = http.get(url);
  
  // Verify that the server is responding with a 200 OK status
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  // Think time: Wait 100ms between requests for each user
  sleep(0.1);
}
