const mongoose = require('mongoose');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');

async function testAPI() {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) throw new Error('MONGODB_URI is required');
        await mongoose.connect(mongoURI);
        console.log('✅ 資料庫連接成功');

        // 測試獲取測驗類型
        const testTypes = await TestQuestion.distinct('testType');
        console.log('📋 可用的測驗類型:', testTypes);

        // 測試獲取特定測驗的題目
        if (testTypes.length > 0) {
            const testData = await TestQuestion.findOne({ testType: testTypes[0] });
            console.log(`📝 ${testTypes[0]} 的題目數量:`, testData.totalQuestions);
            console.log(`📋 第一題:`, testData.questions[0]);
        }

        // 測試獲取用戶測驗記錄
        const testRecords = await TestRecord.find().limit(5);
        console.log('📊 用戶測驗記錄數量:', testRecords.length);
        if (testRecords.length > 0) {
            console.log('📋 第一筆記錄:', {
                userId: testRecords[0].userId,
                testType: testRecords[0].testType,
                timestamp: testRecords[0].timestamp
            });
        }

        console.log('✅ API測試完成');

    } catch (error) {
        console.error('❌ API測試失敗:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ 資料庫連接已關閉');
    }
}

if (require.main === module) {
    testAPI();
}

module.exports = { testAPI };
