const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'http://20.57.128.97:3000';

let currentType = 'news'; // "news" 或 "common"
let homepageList = [];

function getAdminToken() {
    return sessionStorage.getItem('adminToken') || '';
}

function checkAdminAuth() {
    const token = getAdminToken();
    if (!token) window.location.href = '../../main/login-user.html';
}

function fetchData(type = currentType) {
    fetch(`${API_BASE_URL}/api/homepage?type=${type}`)
        .then(res => res.json())
        .then(data => {
            homepageList = data;
            renderInfoList();
        })
        .catch(() => {
            document.getElementById('info-list-section').innerHTML = '<p>載入失敗</p>';
        });
}

function renderInfoList() {
    const list = homepageList || [];
    const root = document.getElementById('info-list-section');
    root.innerHTML = '';
    if (list.length === 0) {
        root.innerHTML = '<p>尚無資訊</p>';
        return;
    }
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="card-image"><img src="${item.imageUrl}" alt="圖片"></div>
            <h2>${item.title}</h2>
            <p style="font-size:13px;color:#888;">${item.description}</p>
            <div style="margin:0.5em 0;">連結: <a href="${item.link}" target="_blank">${item.link}</a></div>
            <div style="display: flex; gap: 10px; margin-top:auto;">
                <button class="edit-btn">編輯</button>
                <button class="delete-btn">刪除</button>
            </div>
        `;
        // 編輯
        card.querySelector('.edit-btn').onclick = () => openEditModal(item);
        // 刪除
        card.querySelector('.delete-btn').onclick = () => deleteInfo(item._id);
        root.appendChild(card);
    });
}

function openEditModal(item = null) {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'block';
    modal.classList.add('show');
    modal.classList.remove('hide');
    
    document.getElementById('modal-title').textContent = item ? '編輯資訊' : '新增資訊';
    document.getElementById('info-id').value = item ? item._id : '';
    document.getElementById('info-type').value = currentType;
    document.getElementById('title').value = item ? item.title : '';
    document.getElementById('description').value = item ? item.description : '';
    document.getElementById('link').value = item ? item.link : '';
    document.getElementById('imageUrl').value = item ? item.imageUrl : '';
    const preview = document.getElementById('preview-image');
    if (item && item.imageUrl) {
        preview.src = item.imageUrl;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
    
    // 防止背景滾動
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'none';
    modal.classList.remove('show');
    modal.classList.add('hide');
    
    document.getElementById('info-form').reset();
    document.getElementById('preview-image').style.display = 'none';
    
    // 恢復背景滾動
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    fetchData();
    
    // 確保 modal 初始狀態是隱藏的
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.classList.add('hide');
    }
    // Tab切換
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.onclick = function() {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentType = this.getAttribute('data-type');
            fetchData();
        }
    });
    // 新增
    document.getElementById('add-btn').onclick = () => openEditModal();
    // 關閉modal
    document.getElementById('cancel-btn').onclick = closeModal;
    
    // 點擊 modal 背景關閉
    document.getElementById('edit-modal').onclick = function(e) {
        if (e.target === this) {
            closeModal();
        }
    };
    
    // ESC 鍵關閉 modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('edit-modal');
            if (modal.style.display === 'block') {
                closeModal();
            }
        }
    });
    // 圖片預覽與上傳
    document.getElementById('image-input').onchange = async function(e){
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('image', file);
        try {
            const res = await fetch(`${API_BASE_URL}/api/homepage/upload-image`, {
                method:'POST',
                headers: { 'Authorization': 'Bearer ' + getAdminToken() },
                body: fd
            });
            const data = await res.json();
            document.getElementById('imageUrl').value = data.imageUrl;
            document.getElementById('preview-image').src = data.imageUrl;
            document.getElementById('preview-image').style.display = 'block';
        } catch {
            alert('圖片上傳失敗');
        }
    }
    // 儲存/編輯
    document.getElementById('info-form').onsubmit = async function(e){
        e.preventDefault();
        const _id = document.getElementById('info-id').value;
        const body = {
            type: currentType,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            link: document.getElementById('link').value,
            imageUrl: document.getElementById('imageUrl').value
        };
        try {
            if (_id) {
                await fetch(`${API_BASE_URL}/api/homepage/${_id}`, {
                    method:'PUT',
                    headers: {'Content-Type': 'application/json','Authorization': 'Bearer '+getAdminToken()},
                    body: JSON.stringify(body)
                });
            } else {
                await fetch(`${API_BASE_URL}/api/homepage`, {
                    method:'POST',
                    headers: {'Content-Type': 'application/json','Authorization': 'Bearer '+getAdminToken()},
                    body: JSON.stringify(body)
                });
            }
            fetchData();
            closeModal();
        } catch {
            alert('操作失敗');
        }
    }
});

function deleteInfo(id) {
    if (!confirm('確定要刪除這筆資訊嗎？')) return;
    fetch(`${API_BASE_URL}/api/homepage/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getAdminToken() }
    }).then(() => fetchData());
}
