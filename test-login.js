const axios = require('axios');

const loginData = {
  email: 'test@example.com',
  password: 'password123'
};

axios.post('http://backend:5000/api/users/login', loginData)
  .then(response => {
    console.log('Login successful:', response.data);
  })
  .catch(error => {
    console.error('Login failed:', error.response?.data || error.message);
  });