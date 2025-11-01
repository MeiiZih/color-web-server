// 測驗結果頁面腳本
document.addEventListener('DOMContentLoaded', function() {
    // 初始化頁面
    initResultPage();
});

/**
 * 初始化結果頁面
 */
function initResultPage() {
    // 設置事件監聽器
    setupEventListeners();
    
    // 檢查用戶是否登入
    const isLoggedIn = checkUserLoggedIn();
    
    // 從URL獲取測驗結果ID (如果有)
    const urlParams = new URLSearchParams(window.location.search);
    const resultId = urlParams.get('id');
    
    if (resultId) {
        // 如果URL中包含結果ID，顯示該測驗結果
        showTestResult(resultId);
    } else if (isLoggedIn) {
        // 用戶已登入但沒有指定結果ID，顯示歷史記錄
        showHistorySection();
    } else {
        // 用戶未登入，顯示登入提示
        showLoginPrompt();
    }
}

/**
 * 設置頁面上各元素的事件監聽器
 */
function setupEventListeners() {
    // 登入按鈕點擊事件
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', function() {
            // 檢查當前登入狀態
            const userToken = localStorage.getItem('userToken');
            if (userToken) {
                // 已登入，執行登出
                logout();
            } else {
                // 未登入，跳轉到登入頁面
                window.location.href = '../main/login-select.html';
            }
        });
    }
    
    // 開始測驗按鈕點擊事件
    const startTestButtons = document.querySelectorAll('.start-test-btn');
    startTestButtons.forEach(button => {
        button.addEventListener('click', function() {
            window.location.href = 'select.html';
        });
    });
    
    // 返回按鈕點擊事件
    const backButton = document.querySelector('.back-button');
    if (backButton) {
        backButton.addEventListener('click', function() {
            // 返回測驗選擇頁面
            window.location.href = 'test.html';
        });
    }
    
    // 測驗記錄按鈕點擊事件
    const historyButton = document.querySelector('.history-button');
    if (historyButton) {
        historyButton.addEventListener('click', function() {
            window.location.href = 'history.html';
        });
    }
    
    // 側邊功能按鈕事件
    const downloadButton = document.querySelector('.side-button[onclick="downloadReport()"]');
    if (downloadButton) {
        downloadButton.addEventListener('click', function() {
            downloadReport();
        });
    }
    
    const shareButton = document.querySelector('.side-button[onclick="shareResult()"]');
    if (shareButton) {
        shareButton.addEventListener('click', function() {
            shareResult();
        });
    }
}

/**
 * 檢查用戶是否已登入
 * @returns {boolean} 是否已登入
 */
function checkUserLoggedIn() {
    const userToken = sessionStorage.getItem('userToken');
    const isGuest = sessionStorage.getItem('isGuest') === 'true';
    return (userToken || isGuest) ? true : false;
}

/**
 * 顯示登入提示區域
 */
function showLoginPrompt() {
    document.getElementById('login-prompt').style.display = 'block';
    document.getElementById('history-section').style.display = 'none';
    document.getElementById('result-detail').style.display = 'none';
}

/**
 * 顯示歷史記錄區域
 */
function showHistorySection() {
    document.getElementById('login-prompt').style.display = 'none';
    document.getElementById('history-section').style.display = 'block';
    document.getElementById('result-detail').style.display = 'none';
    
    // 加載歷史數據
    loadHistoryData();
}

/**
 * 加載測驗歷史數據
 */
function loadHistoryData() {
    // 在實際應用中，這應該是一個API請求，獲取用戶的測驗歷史
    // 這裡使用模擬數據進行展示
    const mockHistoryData = generateMockData().history;
    
    // 渲染歷史記錄列表
    renderHistoryItems(mockHistoryData);
}

/**
 * 渲染歷史記錄項目
 * @param {Array} historyData 歷史記錄數據
 */
function renderHistoryItems(historyData) {
    const historyContainer = document.getElementById('history-items');
    
    // 清空現有內容
    historyContainer.innerHTML = '';
    
    if (historyData && historyData.length > 0) {
        // 有歷史記錄，創建並添加每個記錄項目
        historyData.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            historyItem.innerHTML = `
                <div class="history-info">
                    <div class="history-date">${formatDate(item.date)}</div>
                    <div class="history-result">${item.result}</div>
                </div>
                <button class="view-button" data-id="${item.id}">查看</button>
            `;
            
            historyContainer.appendChild(historyItem);
            
            // 添加查看按鈕點擊事件
            const viewButton = historyItem.querySelector('.view-button');
            viewButton.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                showTestResult(itemId);
            });
        });
    } else {
        // 無歷史記錄
        historyContainer.innerHTML = '<p class="no-history">您還沒有完成任何測驗。開始第一個測驗，探索自己的色彩個性！</p>';
    }
}

/**
 * 顯示測驗結果詳情
 * @param {string} resultId 結果ID
 */
function showTestResult(resultId) {
    // 隱藏其他區域，顯示結果詳情
    document.getElementById('login-prompt').style.display = 'none';
    document.getElementById('history-section').style.display = 'none';
    document.getElementById('result-detail').style.display = 'block';
    
    // 獲取並顯示結果數據
    const resultData = getResultData(resultId);
    
    // 填充結果詳情
    fillResultDetails(resultData);
}

/**
 * 獲取測驗結果數據
 * @param {string} resultId 結果ID
 * @returns {Object} 結果數據
 */
function getResultData(resultId) {
    // 在實際應用中，這應該是一個API請求，根據ID獲取測驗結果
    // 這裡使用模擬數據進行展示
    const mockData = generateMockData();
    
    // 根據ID查找對應的結果數據
    const result = mockData.results.find(item => item.id === resultId);
    
    return result || mockData.results[0]; // 如果找不到對應ID的結果，返回第一個結果
}

/**
 * 填充結果詳情
 * @param {Object} data 結果數據
 */
function fillResultDetails(data) {
    // 更新頁面上的結果詳情
    document.getElementById('mbti-type').textContent = data.mbtiType;
    document.getElementById('color-type').textContent = data.colorType;
    document.getElementById('test-date').textContent = formatDate(data.date);
    
    // 設置色彩標記的背景色
    const colorBadge = document.querySelector('.color-badge');
    if (colorBadge) {
        colorBadge.style.backgroundColor = data.colorCode;
    }
    
    // 更新特質列表
    const traitsList = document.getElementById('traits-list');
    if (traitsList && data.traits) {
        traitsList.innerHTML = '';
        data.traits.forEach(trait => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${trait.title}：</strong>${trait.description}`;
            traitsList.appendChild(li);
        });
    }
    
    // 更新分析內容
    const analysisContent = document.getElementById('analysis-content');
    if (analysisContent) {
        analysisContent.textContent = data.analysis;
    }
}

/**
 * 格式化日期
 * @param {string} dateString 日期字符串
 * @returns {string} 格式化後的日期
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 下載報告功能
 */
function downloadReport() {
    alert('報告下載功能即將推出！');
}

/**
 * 分享結果功能
 */
function shareResult() {
    alert('分享功能即將推出！');
}

/**
 * 登出功能
 */
function logout() {
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('isGuest');
    window.location.href = '../index.html';
}

/**
 * 打印結果
 */
function printResult() {
    window.print();
}

/**
 * 測試用：切換登入狀態
 */
function testLogin() {
    const userToken = localStorage.getItem('userToken');
    if (userToken) {
        // 已登入，清除登入信息
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
    } else {
        // 未登入，設置模擬登入
        localStorage.setItem('userToken', 'mock-token');
        localStorage.setItem('userName', '測試用戶');
    }
    // 重載頁面
    window.location.reload();
}

/**
 * 生成模擬數據
 * @returns {Object} 模擬數據
 */
function generateMockData() {
    return {
        history: [
            {
                id: '1',
                date: '2023-10-15',
                testType: 'MBTI色彩心理測驗',
                result: 'INFJ - 深靛藍'
            },
            {
                id: '2',
                date: '2023-09-20',
                testType: 'MBTI色彩心理測驗',
                result: 'ENFP - 亮黃色'
            },
            {
                id: '3',
                date: '2023-08-05',
                testType: 'MBTI色彩心理測驗',
                result: 'INTJ - 深紫色'
            }
        ],
        results: [
            {
                id: '1',
                mbtiType: 'INFJ - 神秘的理想主義者',
                colorType: '深靛藍',
                colorCode: '#4169E1',
                date: '2023-10-15',
                analysis: '作為INFJ，您的思維方式深邃而富有洞察力。您能夠看到表象之下的本質，並擁有強烈的使命感和道德指南針。您的內心世界豐富而複雜，常常被他人視為神秘而深不可測。您擅長理解他人的情感和需求，這使您成為優秀的傾聽者和支持者。同時，您對自我的要求非常高，有時會因追求完美而感到壓力。',
                traits: [
                    {
                        title: '核心特質',
                        description: '內向且充滿熱情，擁有強烈的價值觀和使命感。'
                    },
                    {
                        title: '情緒特點',
                        description: '情感豐富且細膩，容易感受到他人的需求與情緒。'
                    },
                    {
                        title: '思維方式',
                        description: '追求深度與意義，對未來有清晰的願景。'
                    },
                    {
                        title: '行動模式',
                        description: '偏向計劃與組織，樂於為理想努力。'
                    },
                    {
                        title: '人際關係',
                        description: '重視真誠與深度，偏好小圈子但對朋友極為忠誠。'
                    },
                    {
                        title: '工作風格',
                        description: '追求意義與創新，能夠獨立完成任務且注重細節。'
                    }
                ]
            },
            {
                id: '2',
                mbtiType: 'ENFP - 熱情的創新者',
                colorType: '亮黃色',
                colorCode: '#FFD700',
                date: '2023-09-20',
                analysis: '作為ENFP，您充滿活力、熱情和創造力。您對可能性充滿好奇，總是尋找新的想法和體驗。您的思維敏捷而富有彈性，能夠看到不同觀點並連接看似不相關的概念。您天生就是一個激勵者和溝通者，能夠輕鬆地與各種人建立聯繫。您重視自由和真實性，渴望在生活中表達自己的獨特性。',
                traits: [
                    {
                        title: '核心特質',
                        description: '外向、熱情、富有創造力，充滿好奇心和冒險精神。'
                    },
                    {
                        title: '情緒特點',
                        description: '情感豐富且表現力強，樂觀積極，容易受到環境影響。'
                    },
                    {
                        title: '思維方式',
                        description: '注重可能性和創新，思維跳躍且靈活，善於連接不同概念。'
                    },
                    {
                        title: '行動模式',
                        description: '自發且適應力強，喜歡探索不同選項而非固定計劃。'
                    },
                    {
                        title: '人際關係',
                        description: '開放且友善，容易與他人建立聯繫，喜歡分享想法和感受。'
                    },
                    {
                        title: '工作風格',
                        description: '創意導向，享受團隊合作，擅長激發創新想法和解決問題。'
                    }
                ]
            },
            {
                id: '3',
                mbtiType: 'INTJ - 策略性的思考者',
                colorType: '深紫色',
                colorCode: '#483D8B',
                date: '2023-08-05',
                analysis: '作為INTJ，您是一個策略性的思考者，擅長系統性分析和長期規劃。您對知識有著持續的渴求，並且喜歡深入探究各種概念和理論。您獨立、理性且自信，常常依靠自己的判斷而非外部權威。您的目標導向性很強，有能力將複雜的想法轉化為現實可行的計劃。雖然您可能在社交場合顯得保留，但您的思想深度和原創性常常給他人留下深刻印象。',
                traits: [
                    {
                        title: '核心特質',
                        description: '獨立、理性、策略性思考，具有強烈的目標導向性。'
                    },
                    {
                        title: '情緒特點',
                        description: '情緒內斂且穩定，理性思考優先於情感表達。'
                    },
                    {
                        title: '思維方式',
                        description: '系統性、分析性強，善於長期規劃和策略思考。'
                    },
                    {
                        title: '行動模式',
                        description: '目標明確，注重效率，願意投入時間實現長期計劃。'
                    },
                    {
                        title: '人際關係',
                        description: '選擇性社交，重視智力連接，對無效社交缺乏耐心。'
                    },
                    {
                        title: '工作風格',
                        description: '獨立工作能力強，善於創建系統和流程，追求持續改進。'
                    }
                ]
            }
        ]
    };
} 