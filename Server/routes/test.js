const express = require('express');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');
const adminProtect = require('../middleware/adminProtect');
const router = express.Router();

function getCompatibleTestTypes(rawTestType) {
    const normalized = decodeURIComponent(rawTestType).replace(/[\s\u3000]/g, '');
    const aliases = {
        '色彩性格測驗': ['色彩性格測驗', '我在色彩學中的MBTI'],
        '我在色彩學中的MBTI': ['我在色彩學中的MBTI', '色彩性格測驗']
    };
    return aliases[normalized] || [normalized];
}

// 獲取所有測驗類型
router.get('/types', async (req, res) => {
    try {
        const testTypes = await TestQuestion.distinct('testType');
        res.json(testTypes);
    } catch (error) {
        console.error('獲取測驗類型失敗:', error);
        res.status(500).json({ message: '獲取測驗類型失敗' });
    }
});

// 獲取所有測驗的詳細資訊（用於問卷管理頁面）
router.get('/surveys', async (req, res) => {
    try {
        const surveys = await TestQuestion.find({}, {
            _id: 1,
            testType: 1,
            totalQuestions: 1,
            description: 1, // 新增
            imgUrl: 1, // 加入圖片路徑
            createdAt: 1,
            updatedAt: 1
        }).sort({ createdAt: -1 });
        
        res.json(surveys);
    } catch (error) {
        console.error('獲取問卷列表失敗:', error);
        res.status(500).json({ message: '獲取問卷列表失敗' });
    }
});

// 獲取單一問卷的詳細資訊（用於編輯問卷頁面）
router.get('/surveys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await TestQuestion.findById(id);
        
        if (!survey) {
            return res.status(404).json({ message: '找不到該問卷' });
        }
        
        res.json(survey);
    } catch (error) {
        console.error('獲取問卷詳細資訊失敗:', error);
        res.status(500).json({ message: '獲取問卷詳細資訊失敗' });
    }
});

// 獲取特定測驗類型的所有題目
router.get('/questions/:testType', async (req, res) => {
    try {
        const compatibleTypes = getCompatibleTestTypes(req.params.testType);
        const testData = await TestQuestion.findOne({ testType: { $in: compatibleTypes } });
        
        if (!testData) {
            return res.status(404).json({ message: '找不到該測驗類型' });
        }
        
        res.json({
            testType: testData.testType,
            totalQuestions: testData.totalQuestions,
            description: testData.description, // 新增
            imgUrl: testData.imgUrl, // 加入圖片路徑
            questions: testData.questions
        });
    } catch (error) {
        console.error('獲取題目失敗:', error);
        res.status(500).json({ message: '獲取題目失敗' });
    }
});

// 新增問卷
router.post('/surveys', adminProtect, async (req, res) => {
    try {
        const { testType, totalQuestions, questions, description, imgUrl } = req.body;
        
        // 檢查是否已存在相同名稱的問卷
        const existingSurvey = await TestQuestion.findOne({ testType });
        if (existingSurvey) {
            return res.status(400).json({ message: '問卷名稱已存在' });
        }
        
        const newSurvey = new TestQuestion({
            testType,
            totalQuestions,
            questions,
            description, // 新增
            imgUrl: imgUrl || undefined
        });
        
        await newSurvey.save();
        res.status(201).json({ message: '問卷創建成功', survey: newSurvey });
    } catch (error) {
        console.error('創建問卷失敗:', error);
        res.status(500).json({ message: '創建問卷失敗' });
    }
});

// 更新問卷
router.put('/surveys/:id', adminProtect, async (req, res) => {
    try {
        const { id } = req.params;
        const { testType, totalQuestions, questions, description, imgUrl } = req.body;
        
        // 檢查是否已存在相同名稱的其他問卷
        const existingSurvey = await TestQuestion.findOne({ 
            testType, 
            _id: { $ne: id } 
        });
        if (existingSurvey) {
            return res.status(400).json({ message: '問卷名稱已存在' });
        }
        
        const updatedSurvey = await TestQuestion.findByIdAndUpdate(
            id,
            {
                testType,
                totalQuestions,
                questions,
                description, // 新增
                imgUrl: imgUrl || undefined,
                updatedAt: Date.now()
            },
            { new: true }
        );
        
        if (!updatedSurvey) {
            return res.status(404).json({ message: '找不到該問卷' });
        }
        
        res.json({ message: '問卷更新成功', survey: updatedSurvey });
    } catch (error) {
        console.error('更新問卷失敗:', error);
        res.status(500).json({ message: '更新問卷失敗' });
    }
});

// 刪除問卷
router.delete('/surveys/:id', adminProtect, async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedSurvey = await TestQuestion.findByIdAndDelete(id);
        if (!deletedSurvey) {
            return res.status(404).json({ message: '找不到該問卷' });
        }
        
        // Retiring a questionnaire must not erase any completed research records.
        
        res.json({ message: '問卷刪除成功' });
    } catch (error) {
        console.error('刪除問卷失敗:', error);
        res.status(500).json({ message: '刪除問卷失敗' });
    }
});

// 獲取用戶的測驗統計
router.get('/user-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { testType } = req.query;
        
        let query = { userId };
        if (testType) {
            query.testType = testType;
        }
        
        // 修改排序為升序（最早的測驗在前）
        const records = await TestRecord.find(query).sort({ timestamp: 1 }).select('testType timestamp result mbtiResult colorResult');
        
        // 按測驗類型分組統計
        const stats = {};
        records.forEach(record => {
            if (!stats[record.testType]) {
                stats[record.testType] = [];
            }
            stats[record.testType].push({
                id: record._id,
                timestamp: record.timestamp,
                result: record.result,
                mbtiResult: record.mbtiResult,
                colorResult: record.colorResult
            });
        });
        
        res.json(stats);
    } catch (error) {
        console.error('獲取用戶統計失敗:', error);
        res.status(500).json({ message: '獲取用戶統計失敗' });
    }
});

// 獲取用戶特定測驗類型的詳細記錄
router.get('/user-records/:userId/:testType', async (req, res) => {
    try {
        const { userId, testType } = req.params;
        
        const records = await TestRecord.find({ userId, testType }).sort({ timestamp: -1 });
        
        const formattedRecords = records.map(record => ({
            id: record._id,
            timestamp: record.timestamp,
            result: record.result,
            mbtiResult: record.mbtiResult,
            colorResult: record.colorResult,
            details: record.details,
            answers: record.answers,
            scores: record.scores
        }));
        
        res.json(formattedRecords);
    } catch (error) {
        console.error('獲取用戶記錄失敗:', error);
        res.status(500).json({ message: '獲取用戶記錄失敗' });
    }
});

// 獲取用戶的測驗記錄（根據 email 或 guestId）
router.get('/records', async (req, res) => {
    try {
        const { email, guestId } = req.query;
        
        if (!email && !guestId) {
            return res.status(400).json({ message: '請提供 email 或 guestId 參數' });
        }
        
        let query = {};
        if (email) {
            query.email = email;
        } else if (guestId) {
            query.guestId = guestId;
        }
        
        const records = await TestRecord.find(query).sort({ timestamp: -1 });
        
        const formattedRecords = records.map(record => ({
            id: record._id,
            email: record.email,
            guestId: record.guestId,
            testType: record.testType,
            timestamp: record.timestamp,
            result: record.result,
            mbtiResult: record.mbtiResult,
            colorResult: record.colorResult,
            details: record.details,
            answers: record.answers,
            scores: record.scores
        }));
        
        res.json({ records: formattedRecords });
    } catch (error) {
        console.error('獲取測驗記錄失敗:', error);
        res.status(500).json({ message: '獲取測驗記錄失敗' });
    }
});

// 根據複合條件查詢單筆測驗記錄
router.get('/recordByInfo', async (req, res) => {
    try {
        const { email, guestId, testType, timestamp } = req.query;
        
        if (!testType || !timestamp) {
            return res.status(400).json({ message: '請提供 testType 和 timestamp 參數' });
        }
        
        if (!email && !guestId) {
            return res.status(400).json({ message: '請提供 email 或 guestId 參數' });
        }
        
        let query = { testType, timestamp: new Date(timestamp) };
        if (email) {
            query.email = email;
        } else if (guestId) {
            query.guestId = guestId;
        }
        
        const record = await TestRecord.findOne(query);
        
        if (!record) {
            return res.status(404).json({ message: '找不到該測驗記錄' });
        }
        
        const formattedRecord = {
            id: record._id,
            email: record.email,
            guestId: record.guestId,
            testType: record.testType,
            timestamp: record.timestamp,
            result: record.result,
            mbtiResult: record.mbtiResult,
            colorResult: record.colorResult,
            details: record.details,
            answers: record.answers,
            scores: record.scores
        };
        
        res.json({ success: true, record: formattedRecord });
    } catch (error) {
        console.error('查詢測驗記錄失敗:', error);
        res.status(500).json({ message: '查詢測驗記錄失敗' });
    }
});

// 根據 testType 查詢問卷
router.get('/surveys/type/:testType', async (req, res) => {
    try {
        const compatibleTypes = getCompatibleTestTypes(req.params.testType);
        const testData = await TestQuestion.findOne({ testType: { $in: compatibleTypes } });
        if (!testData) {
            return res.status(404).json({ message: '找不到該測驗類型' });
        }
        res.json({
            testType: testData.testType,
            totalQuestions: testData.totalQuestions,
            description: testData.description,
            imgUrl: testData.imgUrl,
            questions: testData.questions
        });
    } catch (error) {
        console.error('根據 testType 查詢問卷失敗:', error);
        res.status(500).json({ message: '根據 testType 查詢問卷失敗' });
    }
});

// 保存測驗結果記錄
router.post('/saveRecord', async (req, res) => {
    try {
        const {
            userId,
            email,
            guestId,
            userName,
            testType,
            result,
            mbtiResult,
            colorResult,
            details,
            answers,
            scores,
            timestamp
        } = req.body || {};

        if (!email && !guestId) {
            return res.status(400).json({ message: '至少需要提供 email 或 guestId' });
        }
        if (!testType) {
            return res.status(400).json({ message: '缺少 testType' });
        }

        const record = new TestRecord({
            userId: userId || undefined,
            email: email || undefined,
            guestId: guestId || undefined,
            userName: userName || undefined,
            testType,
            result,
            mbtiResult,
            colorResult: {
                primary: Array.isArray(colorResult?.primary) ? colorResult.primary : colorResult?.primary ? [colorResult.primary] : [],
                secondary: Array.isArray(colorResult?.secondary) ? colorResult.secondary : colorResult?.secondary ? [colorResult.secondary] : [],
                third: Array.isArray(colorResult?.third) ? colorResult.third : colorResult?.third ? [colorResult.third] : [],
                fourth: Array.isArray(colorResult?.fourth) ? colorResult.fourth : colorResult?.fourth ? [colorResult.fourth] : []
            },
            details,
            answers,
            scores,
            timestamp: timestamp ? new Date(timestamp) : Date.now()
        });

        await record.save();
        return res.status(201).json({ success: true, id: record._id });
    } catch (error) {
        console.error('保存測驗結果失敗:', error);
        return res.status(500).json({ message: '保存測驗結果失敗' });
    }
});

module.exports = router;
