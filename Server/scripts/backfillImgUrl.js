const mongoose = require('mongoose');
const connectDB = require('../config/db');
const TestQuestion = require('../models/TestQuestion');

(async () => {
    try {
        await connectDB();
        const result = await TestQuestion.updateMany(
            { $or: [ { imgUrl: { $exists: false } }, { imgUrl: null } ] },
            { $set: { imgUrl: '' } }
        );
        console.log('Backfill 完成:', result.modifiedCount, '筆已補上 imgUrl 欄位');
    } catch (err) {
        console.error('Backfill 失敗:', err);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
})();


