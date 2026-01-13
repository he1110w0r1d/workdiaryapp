/**
 * PostgreSQL 连接池 - 用于 RAG 向量存储
 */
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '15432', 10),
    database: process.env.PG_DATABASE || 'workdiary_vectors',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'workdiary123',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    logger.error('PostgreSQL 连接池错误', { message: err.message });
});

pool.on('connect', () => {
    logger.system('PostgreSQL 连接已建立');
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
};
