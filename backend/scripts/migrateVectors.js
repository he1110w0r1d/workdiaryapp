/**
 * 将 MongoDB DiaryEmbedding 迁移到 PostgreSQL
 * 运行: node scripts/migrateVectors.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const pg = require('../utils/pgClient');

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary';

// MongoDB 模型（临时定义，因为原模型可能已删除）
const DiaryEmbeddingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    diary: { type: mongoose.Schema.Types.ObjectId, ref: 'Diary', index: true },
    chunkId: { type: String, index: true },
    text: { type: String },
    vector: { type: [Number], index: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const DiaryEmbedding = mongoose.model('DiaryEmbedding', DiaryEmbeddingSchema);

// 将向量数组转为 PostgreSQL vector 格式
const vectorToSql = (vec) => `[${vec.join(',')}]`;

async function migrate() {
    console.log('正在连接 MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ MongoDB 已连接');

    console.log('正在读取现有向量数据...');
    const docs = await DiaryEmbedding.find({}).lean();
    console.log(`✓ 找到 ${docs.length} 条向量记录`);

    if (docs.length === 0) {
        console.log('没有需要迁移的数据');
        await mongoose.disconnect();
        await pg.pool.end();
        return;
    }

    console.log('正在迁移到 PostgreSQL...');
    let migrated = 0;
    let failed = 0;

    for (const doc of docs) {
        try {
            const userId = String(doc.user);
            const diaryId = String(doc.diary);
            const chunkId = doc.chunkId;
            const text = doc.text || '';
            const vec = doc.vector || [];

            if (!vec.length) {
                console.log(`  跳过空向量: ${chunkId}`);
                continue;
            }

            await pg.query(`
        INSERT INTO diary_embeddings (user_id, diary_id, chunk_id, text, embedding, updated_at)
        VALUES ($1, $2, $3, $4, $5::vector, NOW())
        ON CONFLICT (user_id, diary_id, chunk_id) 
        DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, updated_at = NOW()
      `, [userId, diaryId, chunkId, text, vectorToSql(vec)]);

            migrated++;
            if (migrated % 100 === 0) {
                console.log(`  已迁移 ${migrated}/${docs.length}`);
            }
        } catch (err) {
            console.error(`  迁移失败: ${doc.chunkId}`, err.message);
            failed++;
        }
    }

    console.log(`\n迁移完成！`);
    console.log(`  成功: ${migrated}`);
    console.log(`  失败: ${failed}`);

    await mongoose.disconnect();
    await pg.pool.end();
}

migrate().catch(err => {
    console.error('迁移失败:', err);
    process.exit(1);
});
