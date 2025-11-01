// 動態判斷 API URL
const hostname = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port;
const API_BASE_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? `${protocol}//${hostname}:${port || '3000'}`
    : ''; // 生產環境使用相對路徑
window.addEventListener('DOMContentLoaded', () => {
    fetch(`${API_BASE_URL}/api/homepage?type=common`).then(r => r.json()).then(arr => {
        const root = document.getElementById('all-list');
        if (!root) return;
        root.innerHTML = '';
        if(!arr.length) { root.innerHTML = '<p>目前尚無一般資訊</p>'; return; }
        arr.forEach(item => {
            const a = document.createElement('a');
            a.className = 'info-card';
            a.target = '_blank';
            a.href = item.link;
            a.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}">
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div class="subtitle" style="font-size:13px;color:#888;">${item.description||''}</div>
                </div>
            `;
            root.appendChild(a);
        })
    })
});
