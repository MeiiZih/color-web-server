const mongoose = require('mongoose');
const TestRecord = require('../models/TestRecord');
const User = require('../models/User');

async function testAdminUserRecords() {
    try {
        const mongoURI = 'mongodb+srv://meiizih04:G591eJaRx2YuixPW@cluster0.yq5jdcr.mongodb.net/survey_db';
        await mongoose.connect(mongoURI);
        console.log('✅ 資料庫連接成功');

        // 1. 獲取一個用戶 ID
        console.log('\n👤 1. 獲取用戶資料...');
        const users = await User.find().limit(1);
        if (users.length === 0) {
            console.log('❌ 沒有找到任何用戶');
            return;
        }
        
        const userId = users[0]._id;
        console.log('用戶 ID:', userId);
        console.log('用戶 Email:', users[0].email);

        // 2. 查詢該用戶的所有測驗紀錄
        console.log('\n📊 2. 查詢用戶測驗紀錄...');
        const records = await TestRecord.find({ userId: userId });
        console.log('測驗紀錄數量:', records.length);

        if (records.length === 0) {
            console.log('❌ 該用戶沒有測驗紀錄');
            return;
        }

        // 3. 顯示測驗紀錄詳情
        console.log('\n📋 3. 測驗紀錄詳情:');
        records.forEach((record, index) => {
            const testDate = new Date(record.timestamp).toLocaleString('zh-TW');
            console.log(`\n第${index + 1}次測驗 (${testDate}):`);
            console.log(`  - 測驗類型: ${record.testType}`);
            console.log(`  - MBTI 結果: ${record.mbtiResult || '未記錄'}`);
            console.log(`  - 色彩結果: ${record.colorResult?.primary || '未記錄'}`);
            console.log(`  - 完整結果: ${record.result || '未記錄'}`);
            console.log(`  - 答案數量: ${record.answers?.length || 0}`);
            console.log(`  - 分數: ${record.scores ? JSON.stringify(record.scores) : '未記錄'}`);
        });

        // 4. 按測驗類型分組
        console.log('\n🔍 4. 按測驗類型分組:');
        const recordsByType = {};
        records.forEach(record => {
            if (!recordsByType[record.testType]) {
                recordsByType[record.testType] = [];
            }
            recordsByType[record.testType].push(record);
        });

        Object.keys(recordsByType).forEach(testType => {
            console.log(`\n${testType}: ${recordsByType[testType].length} 次測驗`);
            recordsByType[testType].forEach((record, index) => {
                const testDate = new Date(record.timestamp).toLocaleString('zh-TW');
                console.log(`  第${index + 1}次: ${testDate} - ${record.mbtiResult || '未記錄'}`);
            });
        });

        console.log('\n✅ 管理員查看用戶測驗紀錄功能測試完成');

    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 資料庫連接已關閉');
    }
}

if (require.main === module) {
    testAdminUserRecords();
}

module.exports = { testAdminUserRecords };
