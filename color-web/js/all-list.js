const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : 'http://20.57.128.97:3000';
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
