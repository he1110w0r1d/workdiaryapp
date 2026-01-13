/**
 * 初始化 PostgreSQL pgvector 扩展和向量表
 * 运行: node scripts/initPgVector.js
 */
require('dotenv').config();
const pg = require('../utils/pgClient');

const VECTOR_DIM = parseInt(process.env.VECTOR_DIM || '4096', 10);

async function init() {
    const client = await pg.getClient();
    try {
        console.log('正在初始化 pgvector...');

        // 创建 vector 扩展
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✓ pgvector 扩展已启用');

        // 创建向量表
        await client.query(`
      CREATE TABLE IF NOT EXISTS diary_embeddings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(24) NOT NULL,
        diary_id VARCHAR(24) NOT NULL,
        chunk_id VARCHAR(50) NOT NULL,
        text TEXT NOT NULL,
        embedding vector(${VECTOR_DIM}),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, diary_id, chunk_id)
      )
    `);
        console.log(`✓ diary_embeddings 表已创建 (向量维度: ${VECTOR_DIM})`);

        // 创建用户索引
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user 
      ON diary_embeddings(user_id)
    `);
        console.log('✓ 用户索引已创建');

        // 注意：HNSW 索引最大支持 2000 维，而 Qwen3-Embedding-8B 是 4096 维
        // 对于 4096 维向量，有以下选择：
        // 1. 不建索引，使用精确搜索（适合小数据量）
        // 2. 使用 IVFFlat 索引（需要先有数据才能训练）
        // 这里先不建向量索引，待数据量增大后再考虑 IVFFlat
        console.log('✓ 跳过向量索引（4096维超过HNSW限制，小数据量使用精确搜索）');

        console.log('\n初始化完成！');
    } catch (err) {
        console.error('初始化失败:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pg.pool.end();
    }
}

init();
