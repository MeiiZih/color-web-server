const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // MongoDB Atlas 連接字符串
        const mongoURI = 'mongodb+srv://meiizih04:G591eJaRx2YuixPW@cluster0.yq5jdcr.mongodb.net/survey_db';
        
        console.log('正在連接到 MongoDB Atlas...');
        
        await mongoose.connect(mongoURI);

        console.log('✅ MongoDB Atlas 連接成功');
        console.log(`資料庫名稱: ${mongoose.connection.name}`);
    } catch (error) {
        console.error('❌ MongoDB 連接錯誤:');
        console.error('錯誤詳情:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
