// 動態判斷 API URL
const hostname = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port;
const API_BASE_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? `${protocol}//${hostname}:${port || '3000'}`
    : ''; // 生產環境使用相對路徑
window.addEventListener('DOMContentLoaded', () => {
    fetch(`${API_BASE_URL}/api/homepage?type=news`).then(r => r.json()).then(arr => {
        const root = document.getElementById('events-list');
        if (!root) return;
        root.innerHTML = '';
        (arr.slice(0, 8) || []).forEach(item => {
            const a = document.createElement('a');
            a.className = 'event-card';
            a.href = item.link;
            a.target = '_blank';
            a.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}" class="event-image">
                <div class="event-content">
                    <div class="event-date">${new Date(item.createdAt).toLocaleDateString('zh-TW')}</div>
                    <h3 class="event-title">${item.title}</h3>
                    <p class="event-desc" style="font-size:14px;color:#888;">${item.description || ''}</p>
                </div>
            `;
            root.appendChild(a);
        });
        if(!arr.length) root.innerHTML = '<p>目前尚無活動資訊</p>';
    })
});
