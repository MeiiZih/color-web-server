const Homepage = require('../models/Homepage');
const TestQuestion = require('../models/TestQuestion');
const colorTestQuestions = require('../data/finalSurveyQuestions');

const defaultNews = []; // School-only historical activities are no longer seeded.

const defaultResources = [
    {
        type: 'common',
        title: 'FarHugs 抱抱心身醫學',
        imageUrl: '/assets/images/farhugs.png',
        link: 'https://clinic.farhugs.com/',
        description: '身心科門診與心理健康服務。'
    },
    {
        type: 'common',
        title: 'tree.fm 森林聲音',
        imageUrl: '/assets/images/tree.fm.jpg',
        link: 'https://www.tree.fm/',
        description: '聆聽來自世界各地的森林聲景。'
    },
    {
        type: 'common',
        title: 'WindowSwap 世界窗景',
        imageUrl: '/assets/images/window-swap.png',
        link: 'https://www.window-swap.com/',
        description: '透過世界各地的窗景，給自己一段喘息時間。'
    },
    {
        type: 'common',
        title: '台灣心動家族兒童青少年關懷協會',
        imageUrl: '/assets/images/台灣心動家族.png',
        link: 'https://www.tc-adhd.com/',
        description: '兒童青少年情緒行為與家庭支持資源。'
    },
    {
        type: 'common',
        title: '台北市生命線協會',
        imageUrl: '/assets/images/台北生命協會.png',
        link: 'https://www.lifeline.org.tw/',
        description: '心理支持、危機協談與自殺防治資源。'
    },
    {
        type: 'common',
        title: '衛生福利部心理健康司',
        imageUrl: '/assets/images/衛福部.png',
        link: 'https://dep.mohw.gov.tw/domhaoh/np-326-107.html',
        description: '心理健康促進、安心專線與各地諮商資源。'
    }
];

const defaultSurvey = {
    testType: '我在色彩學中的MBTI',
    totalQuestions: colorTestQuestions.length,
    questions: colorTestQuestions,
    description: '從日常選擇探索個性與色彩的連結。共 20 題，約需 6 分鐘，請依第一直覺作答。本測驗僅供自我探索，不能取代心理師或醫師的專業評估。',
    imgUrl: '/assets/images/test.png'
};

async function insertHomepageDefaults(type, items) {
    if (!items.length) return 0;
    const existingCount = await Homepage.countDocuments({ type });
    if (existingCount > 0) return 0;

    const baseTime = Date.now() - items.length * 1000;
    await Homepage.insertMany(items.map((item, index) => ({
        ...item,
        createdAt: new Date(baseTime + index * 1000),
        updatedAt: new Date(baseTime + index * 1000)
    })));
    return items.length;
}

async function seedDefaultContent() {
    const [newsInserted, resourcesInserted] = await Promise.all([
        insertHomepageDefaults('news', defaultNews),
        insertHomepageDefaults('common', defaultResources)
    ]);

    const existingSurvey = await TestQuestion.findOne({
        testType: { $in: ['我在色彩學中的MBTI', '色彩性格測驗'] }
    });

    let surveyInserted = 0;
    let surveyUpdated = 0;
    if (!existingSurvey) {
        await TestQuestion.create(defaultSurvey);
        surveyInserted = 1;
    } else if (existingSurvey.questions.length !== colorTestQuestions.length) {
        existingSurvey.totalQuestions = colorTestQuestions.length;
        existingSurvey.questions = colorTestQuestions;
        existingSurvey.description = defaultSurvey.description;
        existingSurvey.imgUrl = existingSurvey.imgUrl || defaultSurvey.imgUrl;
        await existingSurvey.save();
        surveyUpdated = 1;
    }

    console.log(`Default content ready: ${newsInserted} news, ${resourcesInserted} resources, ${surveyInserted} survey created, ${surveyUpdated} survey updated`);
}

module.exports = seedDefaultContent;
