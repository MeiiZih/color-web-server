// API處理函數 - 測驗相關

// 載入統一的 API 配置（如果尚未載入）
if (typeof window.API_BASE_URL === 'undefined') {
    // 使用動態判斷
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    window.API_BASE_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? `${protocol}//${hostname}:${port || '3000'}`
        : ''; // 生產環境使用相對路徑
}

const API_BASE_URL = window.API_BASE_URL;
console.log('當前API基礎URL:', API_BASE_URL || '(使用相對路徑)');

// 保存測驗記錄到資料庫
async function saveTestRecord(testData) {
    const userEmail = sessionStorage.getItem('userEmail');
    const userName = sessionStorage.getItem('userName');
    const isGuest = sessionStorage.getItem('isGuest');
    const email = isGuest ? '訪客' : userEmail;
    
    if (!email) return; // 未登入不保存
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/test/saveRecord`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                userName: userName || 'unknown',
                testType: testData.testType,
                result: testData.result,
                details: testData.details,
                date: testData.date || new Date().toISOString(),
                selections: testData.selections || []
            }),
        });
        
        if (!response.ok) {
            throw new Error('保存測驗記錄失敗');
        }
        
        // 更新本地存儲
        const testHistory = JSON.parse(sessionStorage.getItem('testHistory')) || [];
        testHistory.push(testData);
        sessionStorage.setItem('testHistory', JSON.stringify(testHistory));
        
        console.log('測驗記錄已成功保存到資料庫');
        return true;
    } catch (error) {
        console.error('保存測驗記錄錯誤:', error);
        // 如果API請求失敗，只保存到本地
        const testHistory = JSON.parse(sessionStorage.getItem('testHistory')) || [];
        testHistory.push(testData);
        sessionStorage.setItem('testHistory', JSON.stringify(testHistory));
        return false;
    }
}

// 從資料庫獲取測驗記錄
async function fetchTestRecords() {
    const userEmail = sessionStorage.getItem('userEmail');
    const isGuest = sessionStorage.getItem('isGuest');
    const email = isGuest ? '訪客' : userEmail;
    
    if (!email) return []; // 未登入返回空數組
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/test/records?email=${email}`);
        const data = await response.json();
        
        if (response.ok) {
            return data.records || [];
        } else {
            // 如果API請求失敗，則使用本地存儲
            return JSON.parse(sessionStorage.getItem('testHistory')) || [];
        }
    } catch (error) {
        console.error('獲取測驗記錄錯誤:', error);
        // 出錯時使用本地存儲
        return JSON.parse(sessionStorage.getItem('testHistory')) || [];
    }
}

// 獲取特定ID的測驗記錄詳情
async function fetchTestDetail(testId) {
    const userEmail = sessionStorage.getItem('userEmail');
    const isGuest = sessionStorage.getItem('isGuest');
    const email = isGuest ? '訪客' : userEmail;
    
    if (!email || !testId) return null; // 未登入或沒有ID返回null
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/test/record/${testId}?email=${email}`);
        const data = await response.json();
        
        if (response.ok) {
            return data.record || null;
        } else {
            // 如果API請求失敗，嘗試從本地找
            const testHistory = JSON.parse(sessionStorage.getItem('testHistory')) || [];
            return testHistory.find(record => record.id === testId) || null;
        }
    } catch (error) {
        console.error('獲取測驗詳情錯誤:', error);
        // 出錯時嘗試從本地找
        const testHistory = JSON.parse(sessionStorage.getItem('testHistory')) || [];
        return testHistory.find(record => record.id === testId) || null;
    }
}

// 根據 email、testType、timestamp 或 guestId、testType、timestamp 查詢單筆紀錄
async function fetchTestDetailByInfo(email, testType, timestamp, guestId = null) {
    if (!testType || !timestamp) return null;
    if (!email && !guestId) return null;
    
    try {
        let queryParams = `testType=${encodeURIComponent(testType)}&timestamp=${encodeURIComponent(timestamp)}`;
        if (email) {
            queryParams += `&email=${encodeURIComponent(email)}`;
        } else if (guestId) {
            queryParams += `&guestId=${encodeURIComponent(guestId)}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/test/recordByInfo?${queryParams}`);
        const data = await response.json();
        if (response.ok && data.success) {
            return data.record || null;
        } else {
            return null;
        }
    } catch (error) {
        console.error('複合條件查詢紀錄錯誤:', error);
        return null;
    }
}

// 產生唯一ID
function generateTestId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
} 