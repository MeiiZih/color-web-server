// Server/config/db.js
const mongoose = require('mongoose');

const isProd = process.env.NODE_ENV === 'production';

// 僅在開發環境允許 fallback；正式環境一定要從環境變數拿 URI
const uri =
  process.env.MONGODB_URI ||
  (!isProd ? 'mongodb://127.0.0.1:27017/survey_db' : null);

const explicitDbName = process.env.MONGODB_DBNAME || ''; // 可選

if (!uri) {
  throw new Error('MONGODB_URI is required in production');
}

async function connectDB() {
  try {
    const options = {
      // 連線逾時避免卡住
      serverSelectionTimeoutMS: 30000,
    };
    // 若額外提供了 DB 名稱，就用 options 指定（當你 URI 沒帶 DB 時很有用）
    if (explicitDbName) options.dbName = explicitDbName;

    console.log('正在連接到 MongoDB Atlas…');
    const conn = await mongoose.connect(uri, options);

    console.log('✅ MongoDB Atlas 連接成功');
    console.log('資料庫名稱:', conn.connection.db.databaseName);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB 連接錯誤:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
