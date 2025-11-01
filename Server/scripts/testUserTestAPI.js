const mongoose = require('mongoose');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');

async function testUserTestAPI() {
    try {
        const mongoURI = 'mongodb+srv://meiizih04:G591eJaRx2YuixPW@cluster0.yq5jdcr.mongodb.net/survey_db';
        await mongoose.connect(mongoURI);
        console.log('✅ 資料庫連接成功');

        // 1. 測試獲取測驗類型
        console.log('\n📋 測試獲取測驗類型...');
        const testTypes = await TestQuestion.distinct('testType');
        console.log('可用的測驗類型:', testTypes);

        // 2. 測試獲取用戶測驗紀錄
        console.log('\n📊 測試獲取用戶測驗紀錄...');
        const testRecords = await TestRecord.find().limit(5);
        console.log('用戶測驗記錄數量:', testRecords.length);
        
        if (testRecords.length > 0) {
            const firstRecord = testRecords[0];
            console.log('第一筆記錄:', {
                userId: firstRecord.userId,
                email: firstRecord.email,
                testType: firstRecord.testType,
                timestamp: firstRecord.timestamp,
                result: firstRecord.result,
                mbtiResult: firstRecord.mbtiResult,
                colorResult: firstRecord.colorResult
            });

            // 3. 測試按用戶ID和測驗類型查詢
            console.log('\n🔍 測試按用戶ID和測驗類型查詢...');
            const userStats = await TestRecord.find({ 
                userId: firstRecord.userId,
                testType: firstRecord.testType 
            }).sort({ timestamp: -1 });
            
            console.log(`用戶 ${firstRecord.userId} 的 ${firstRecord.testType} 測驗記錄:`, userStats.length);
            
            if (userStats.length > 0) {
                console.log('測驗記錄詳情:');
                userStats.forEach((record, index) => {
                    console.log(`  第${index + 1}次: ${record.timestamp} - ${record.result || '無結果'}`);
                });
            }
        }

        console.log('\n✅ user-test API 測試完成');

    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 資料庫連接已關閉');
    }
}

if (require.main === module) {
    testUserTestAPI();
}

module.exports = { testUserTestAPI };
