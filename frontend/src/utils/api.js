import axios from 'axios';

// 创建axios实例
const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:5000/api`;
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || defaultApiUrl,
  withCredentials: true, // 携带跨域Cookie以支持SSO免登录
  timeout: 600000 // 增加到600秒（10分钟），适应月度/年度总结生成时间
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      const reqUrl = error.config?.url || '';
      const isLoginRequest = reqUrl.includes('/users/login');
      const isRegisterRequest = reqUrl.includes('/users/register');
      const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/welcome';
      if (!isLoginRequest && !isRegisterRequest && !isOnLoginPage) {
        window.location.href = '/login';
      }
      // 对登录页的401错误不进行跳转，让页面自行显示错误信息
    }
    return Promise.reject(error);
  }
);

export default api;
