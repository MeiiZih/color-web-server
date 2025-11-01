// 統一的 API 配置檔案
// 在 Render 部署時，前後端在同一個域名下，使用相對路徑即可

(function() {
    'use strict';
    
    // 自動判斷 API 基礎 URL
    // 本地開發時使用完整 URL，部署時使用相對路徑
    const getApiBaseUrl = function() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = window.location.port;
        
        // 本地開發環境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `${protocol}//${hostname}:${port || '3000'}`;
        }
        
        // 生產環境（Render 或其他雲端平台）- 使用相對路徑
        return '';
    };
    
    // 導出到全域
    window.API_BASE_URL = getApiBaseUrl();
    window.apiBaseUrl = getApiBaseUrl(); // 兼容不同命名
    
    // 輔助函數：建立完整的 API URL
    window.getApiUrl = function(endpoint) {
        const baseUrl = getApiBaseUrl();
        // 移除 endpoint 開頭的斜線（如果有的話）
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return baseUrl + cleanEndpoint;
    };
    
    console.log('API 基礎 URL:', window.API_BASE_URL || '(使用相對路徑)');
})();

