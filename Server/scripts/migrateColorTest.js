const mongoose = require('mongoose');
const TestQuestion = require('../models/TestQuestion');
const colorTestQuestions = require('../data/finalSurveyQuestions');

const colorTestDescription = '我們是國立臺中科技大學資訊管理系的學生。此份問卷主要想探討 MBTI 與色彩學之間的聯繫。整份問卷共有 20 道題目，約需 6 分鐘，請依第一直覺作答。';

async function migrateColorTest() {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is required');
        }

        await mongoose.connect(mongoURI);
        console.log('已連接到 MongoDB');

        const result = await TestQuestion.findOneAndUpdate(
            { testType: { $in: ['我在色彩學中的MBTI', '色彩性格測驗'] } },
            {
                testType: '我在色彩學中的MBTI',
                totalQuestions: colorTestQuestions.length,
                questions: colorTestQuestions,
                description: colorTestDescription,
                imgUrl: '/assets/images/test.png',
                updatedAt: new Date()
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(`測驗資料同步完成：${result.testType}，共 ${result.totalQuestions} 題`);
        return result;
    } catch (error) {
        console.error('測驗資料同步失敗:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    migrateColorTest().catch(() => {
        process.exitCode = 1;
    });
}

module.exports = { migrateColorTest, colorTestQuestions, colorTestDescription };
