// 測驗結果頁面腳本
document.addEventListener('DOMContentLoaded', function() {
    // 獲取頁面元素
    const loginPrompt = document.getElementById('loginPrompt');
    const noHistoryPrompt = document.getElementById('noHistoryPrompt');
    const historyList = document.getElementById('historyList');
    const resultDetail = document.getElementById('resultDetail');
    
    // 檢查用戶是否登入
    checkLoginStatus();
    
    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            // 用戶未登入，顯示登入提示
            showLoginPrompt();
        } else {
            // 用戶已登入，獲取測驗記錄
            fetchTestHistory();
        }
    }
    
    function showLoginPrompt() {
        // 顯示登入提示，隱藏其他區域
        loginPrompt.style.display = 'block';
        noHistoryPrompt.style.display = 'none';
        historyList.style.display = 'none';
        resultDetail.style.display = 'none';
        
        // 設置登入按鈕點擊事件
        document.getElementById('loginButton').addEventListener('click', function() {
            window.location.href = '../user/login.html';
        });
    }
    
    function fetchTestHistory() {
        const token = localStorage.getItem('token');
        
        // 向後端 API 請求測驗記錄
        fetch('../api/test/history', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                if (data.history && data.history.length > 0) {
                    // 顯示測驗記錄列表
                    displayTestHistory(data.history);
                } else {
                    // 無測驗記錄，顯示提示
                    showNoHistoryPrompt();
                }
            } else {
                console.error('Error fetching test history:', data.message);
                showNoHistoryPrompt();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNoHistoryPrompt();
        });
    }
    
    function displayTestHistory(historyData) {
        // 隱藏其他區域，顯示歷史列表
        loginPrompt.style.display = 'none';
        noHistoryPrompt.style.display = 'none';
        historyList.style.display = 'block';
        resultDetail.style.display = 'none';
        
        // 清空歷史列表
        historyList.innerHTML = '<h2 class="result-title">測驗紀錄</h2>';
        
        // 創建歷史記錄項目
        historyData.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // 格式化日期
            const testDate = new Date(item.date);
            const formattedDate = `${testDate.getFullYear()}-${(testDate.getMonth() + 1).toString().padStart(2, '0')}-${testDate.getDate().toString().padStart(2, '0')}`;
            
            historyItem.innerHTML = `
                <div class="history-date">${formattedDate}</div>
                <div class="history-type">${item.testType}</div>
                <div class="history-result">${item.result}</div>
                <button class="view-detail-button" data-id="${item.id}">查看詳情</button>
            `;
            
            historyList.appendChild(historyItem);
        });
        
        // 添加查看詳情按鈕點擊事件
        document.querySelectorAll('.view-detail-button').forEach(button => {
            button.addEventListener('click', function() {
                const testId = this.getAttribute('data-id');
                fetchTestDetail(testId);
            });
        });
    }
    
    function showNoHistoryPrompt() {
        // 顯示無測驗記錄提示
        loginPrompt.style.display = 'none';
        noHistoryPrompt.style.display = 'block';
        historyList.style.display = 'none';
        resultDetail.style.display = 'none';
        
        // 設置開始測驗按鈕點擊事件
        document.getElementById('startTestButton').addEventListener('click', function() {
            window.location.href = '../test/select.html';
        });
    }
    
    function fetchTestDetail(testId) {
        const token = localStorage.getItem('token');
        
        // 向後端 API 請求測驗詳情
        fetch(`../api/test/detail/${testId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 顯示測驗詳情
                displayTestDetail(data.detail);
            } else {
                console.error('Error fetching test detail:', data.message);
                alert('無法獲取測驗詳情，請稍後再試');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('發生錯誤，請稍後再試');
        });
    }
    
    function displayTestDetail(detailData) {
        // 隱藏其他區域，顯示詳情頁面
        loginPrompt.style.display = 'none';
        noHistoryPrompt.style.display = 'none';
        historyList.style.display = 'none';
        resultDetail.style.display = 'block';
        
        // 填充詳情內容
        document.getElementById('testType').textContent = detailData.testType;
        document.getElementById('testDate').textContent = new Date(detailData.date).toLocaleDateString();
        document.getElementById('mbtiType').textContent = detailData.mbtiType || 'N/A';
        document.getElementById('colorType').textContent = detailData.colorType || 'N/A';
        
        // 填充性格特質
        const traitsList = document.getElementById('personalityTraits');
        traitsList.innerHTML = '';
        
        if (detailData.traits && detailData.traits.length > 0) {
            detailData.traits.forEach(trait => {
                const li = document.createElement('li');
                li.textContent = trait;
                traitsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = '無可用的性格特質資料';
            traitsList.appendChild(li);
        }
        
        // 返回列表按鈕點擊事件
        document.getElementById('backToListButton').addEventListener('click', function() {
            // 返回測驗記錄列表
            loginPrompt.style.display = 'none';
            noHistoryPrompt.style.display = 'none';
            historyList.style.display = 'block';
            resultDetail.style.display = 'none';
        });
    }
    
    // 模擬測試數據 (開發階段使用，實際上線時移除)
    function simulateTestData() {
        // 如果後端 API 尚未實現，可以用此函數模擬數據
        const mockHistory = [
            {
                id: 1,
                date: '2023-08-15',
                testType: 'MBTI 性格測試',
                result: 'INTJ - 建築師'
            },
            {
                id: 2,
                date: '2023-09-20',
                testType: '色彩心理測試',
                result: '藍色系 - 冷靜思考者'
            },
            {
                id: 3,
                date: '2023-10-05',
                testType: '綜合性格分析',
                result: 'INFP/紫色系 - 理想主義者'
            }
        ];
        
        const mockDetail = {
            id: 1,
            testType: 'MBTI 性格測試',
            date: '2023-08-15',
            mbtiType: 'INTJ',
            colorType: '深藍色',
            traits: [
                '善於策略思考，常對未來有清晰的願景',
                '獨立自主，重視個人空間和自由',
                '理性客觀，善於分析複雜問題',
                '追求知識和自我提升',
                '對自己和他人都有較高的標準'
            ]
        };
        
        // 根據測試需要，模擬顯示歷史列表或詳情
        displayTestHistory(mockHistory);
        
        // 模擬點擊事件，顯示詳情
        document.querySelector('.view-detail-button').addEventListener('click', function() {
            displayTestDetail(mockDetail);
        });
    }
    
    // 如果需要模擬數據，取消下面的註釋
    // simulateTestData();
}); 