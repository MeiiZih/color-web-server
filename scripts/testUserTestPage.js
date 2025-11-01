const mongoose = require('mongoose');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');

async function testUserTestPage() {
    try {
        const mongoURI = 'mongodb+srv://meiizih04:G591eJaRx2YuixPW@cluster0.yq5jdcr.mongodb.net/survey_db';
        await mongoose.connect(mongoURI);
        console.log('✅ 資料庫連接成功');

        // 模擬 user-test.html 頁面的功能
        console.log('\n🎯 模擬 user-test.html 頁面功能...');

        // 1. 獲取測驗名稱（從 TestQuestion 資料表）
        console.log('\n📋 1. 獲取測驗名稱...');
        const testTypes = await TestQuestion.distinct('testType');
        console.log('可用的測驗類型:', testTypes);

        if (testTypes.length === 0) {
            console.log('❌ 沒有找到任何測驗類型');
            return;
        }

        // 2. 獲取用戶測驗紀錄
        console.log('\n📊 2. 獲取用戶測驗紀錄...');
        const testRecords = await TestRecord.find().limit(10);
        console.log('總測驗記錄數量:', testRecords.length);

        if (testRecords.length === 0) {
            console.log('❌ 沒有找到任何測驗記錄');
            return;
        }

        // 3. 模擬選擇第一個測驗類型和用戶
        const selectedTestType = testTypes[0];
        const firstRecord = testRecords[0];
        const userId = firstRecord.userId;

        console.log(`\n🔍 3. 查詢用戶 ${userId} 的 ${selectedTestType} 測驗記錄...`);

        // 4. 獲取特定用戶的特定測驗記錄
        const userTestRecords = await TestRecord.find({ 
            userId: userId,
            testType: selectedTestType 
        }).sort({ timestamp: -1 });

        console.log(`用戶 ${userId} 的 ${selectedTestType} 測驗記錄數量:`, userTestRecords.length);

        if (userTestRecords.length > 0) {
            console.log('\n📋 測驗記錄詳情:');
            userTestRecords.forEach((record, index) => {
                const testDate = new Date(record.timestamp).toLocaleString('zh-TW');
                console.log(`  第${index + 1}次測驗 (${testDate}):`);
                console.log(`    - MBTI: ${record.mbtiResult || '未記錄'}`);
                console.log(`    - 色彩: ${record.colorResult?.primary || '未記錄'}`);
                console.log(`    - 結果: ${record.result || '未記錄'}`);
            });

            // 5. 模擬顯示第一次測驗的結果
            const firstTestRecord = userTestRecords[0];
            console.log('\n📊 5. 顯示第一次測驗結果:');
            console.log(`測驗類型: ${firstTestRecord.testType}`);
            console.log(`測驗時間: ${new Date(firstTestRecord.timestamp).toLocaleString('zh-TW')}`);
            console.log(`MBTI 類型: ${firstTestRecord.mbtiResult || '未記錄'}`);
            console.log(`代表色彩: ${firstTestRecord.colorResult?.primary || '未記錄'}`);
            console.log(`完整結果: ${firstTestRecord.result || '未記錄'}`);
        }

        console.log('\n✅ user-test 頁面功能測試完成');

    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 資料庫連接已關閉');
    }
}

if (require.main === module) {
    testUserTestPage();
}

module.exports = { testUserTestPage };
