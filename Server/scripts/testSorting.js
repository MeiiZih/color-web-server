const mongoose = require('mongoose');
const TestRecord = require('../models/TestRecord');

async function testSorting() {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) throw new Error('MONGODB_URI is required');
        await mongoose.connect(mongoURI);
        console.log('✅ 資料庫連接成功');

        // 測試排序功能
        console.log('\n🔍 測試測驗序排序...');

        // 獲取所有測驗記錄
        const allRecords = await TestRecord.find().sort({ timestamp: 1 });
        console.log('總測驗記錄數量:', allRecords.length);

        if (allRecords.length > 0) {
            // 找到第一個用戶的記錄
            const firstUserId = allRecords[0].userId;
            const firstTestType = allRecords[0].testType;

            console.log(`\n📊 用戶 ${firstUserId} 的 ${firstTestType} 測驗記錄:`);

            // 按升序查詢該用戶的特定測驗記錄
            const userRecords = await TestRecord.find({ 
                userId: firstUserId,
                testType: firstTestType 
            }).sort({ timestamp: 1 });

            console.log(`測驗記錄數量: ${userRecords.length}`);

            if (userRecords.length > 0) {
                console.log('\n📋 測驗序排序結果:');
                userRecords.forEach((record, index) => {
                    const testDate = new Date(record.timestamp).toLocaleString('zh-TW');
                    console.log(`  第${index + 1}次測驗 (${testDate}):`);
                    console.log(`    - MBTI: ${record.mbtiResult || '未記錄'}`);
                    console.log(`    - 色彩: ${record.colorResult?.primary || '未記錄'}`);
                    console.log(`    - 結果: ${record.result || '未記錄'}`);
                });

                // 驗證排序是否正確
                console.log('\n✅ 排序驗證:');
                for (let i = 0; i < userRecords.length - 1; i++) {
                    const currentTime = new Date(userRecords[i].timestamp);
                    const nextTime = new Date(userRecords[i + 1].timestamp);
                    
                    if (currentTime <= nextTime) {
                        console.log(`  ✓ 第${i + 1}次測驗 (${currentTime.toLocaleString('zh-TW')}) <= 第${i + 2}次測驗 (${nextTime.toLocaleString('zh-TW')})`);
                    } else {
                        console.log(`  ✗ 排序錯誤: 第${i + 1}次測驗 > 第${i + 2}次測驗`);
                    }
                }
            }
        }

        console.log('\n✅ 排序測試完成');

    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 資料庫連接已關閉');
    }
}

if (require.main === module) {
    testSorting();
}

module.exports = { testSorting };
