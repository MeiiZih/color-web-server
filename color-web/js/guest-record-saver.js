// 訪客記錄儲存腳本
// 在頁面關閉前儲存訪客的測驗記錄

document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否為訪客
    const isGuest = sessionStorage.getItem('isGuest') === 'true';
    const guestId = sessionStorage.getItem('guestId');
    
    if (!isGuest || !guestId) {
        return; // 不是訪客或沒有 guestId，不需要處理
    }
    
    // 頁面關閉前儲存記錄
    window.addEventListener('beforeunload', function(e) {
        saveGuestSessionData();
    });
    
    // 頁面隱藏時也儲存（手機切換應用時）
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            saveGuestSessionData();
        }
    });
});

// 儲存訪客會話資料
async function saveGuestSessionData() {
    try {
        const isGuest = sessionStorage.getItem('isGuest') === 'true';
        const guestId = sessionStorage.getItem('guestId');
        
        if (!isGuest || !guestId) {
            return;
        }
        
        // 收集當前的測驗記錄
        const currentTestResult = localStorage.getItem('currentTestResult');
        const guestSessionData = {
            guestId: guestId,
            timestamp: new Date().toISOString(),
            testResults: currentTestResult ? JSON.parse(currentTestResult) : null,
            sessionData: {
                isGuest: sessionStorage.getItem('isGuest'),
                guestId: sessionStorage.getItem('guestId'),
                userName: sessionStorage.getItem('userName'),
                userEmail: sessionStorage.getItem('userEmail')
            }
        };
        
        // 發送到後端儲存
        await fetch('/api/guest/save-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(guestSessionData)
        });
        
        console.log('訪客會話資料已儲存');
    } catch (error) {
        console.error('儲存訪客會話資料失敗:', error);
    }
}

// 頁面載入時恢復訪客資料
async function restoreGuestSessionData() {
    try {
        const isGuest = sessionStorage.getItem('isGuest') === 'true';
        const guestId = sessionStorage.getItem('guestId');
        
        if (!isGuest || !guestId) {
            return;
        }
        
        const response = await fetch(`/api/guest/get-session?guestId=${encodeURIComponent(guestId)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.sessionData) {
                // 恢復會話資料
                Object.keys(data.sessionData).forEach(key => {
                    if (data.sessionData[key]) {
                        sessionStorage.setItem(key, data.sessionData[key]);
                    }
                });
            }
        }
    } catch (error) {
        console.error('恢復訪客會話資料失敗:', error);
    }
}
