// navbar.js - 導覽列與登入狀態統一管理

// 動態渲染導覽列
function renderNavbar() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    navLinks.innerHTML = '';

    // 取得登入狀態
    const adminEmail = sessionStorage.getItem('adminEmail');
    const adminName = sessionStorage.getItem('adminName');
    const userEmail = sessionStorage.getItem('userEmail');
    const userName = sessionStorage.getItem('userName');
    const isGuest = sessionStorage.getItem('isGuest') === 'true';
    const guestId = sessionStorage.getItem('guestId');
    const currentPath = window.location.pathname;

    // 判斷身分
    let identity = 'guest';
    if (adminEmail && adminName) {
        identity = 'admin';
    } else if (userEmail && userName) {
        identity = 'user';
    } else if (isGuest && guestId) {
        identity = 'guestUser';
    }

    // 管理員導覽列
    if (identity === 'admin') {
        // 根據目前頁面層級產生正確路徑
        let toCommon = '', toEditCommon = '', toAdmin = '';
        if (currentPath.includes('/main/admin/')) {
            toCommon = '../../main/common.html';
            toEditCommon = 'EditCommon.html';
            toAdmin = 'admin.html';
        } else if (currentPath.includes('/main/')) {
            toCommon = 'common.html';
            toEditCommon = 'admin/EditCommon.html';
            toAdmin = 'admin/admin.html';
        } else {
            toCommon = 'main/common.html';
            toEditCommon = 'main/admin/EditCommon.html';
            toAdmin = 'main/admin/admin.html';
        }
        navLinks.appendChild(createNavLink('首頁', toCommon, currentPath.includes('common.html')));
        navLinks.appendChild(createNavLink('首頁管理', toEditCommon, currentPath.includes('EditCommon.html')));
        navLinks.appendChild(createNavLink('後臺管理', toAdmin, currentPath.includes('admin.html')));
        navLinks.appendChild(createAdminDropdown(adminName, adminEmail));
    } else {
        // 一般用戶/訪客導覽列
        navLinks.appendChild(createNavLink('首頁', getRelativePath('main/common.html'), currentPath.includes('common.html')));
        navLinks.appendChild(createNavLink('測驗系統', getRelativePath('test/test.html'), currentPath.includes('test')));
        navLinks.appendChild(createNavLink('關於我們', getRelativePath('main/about.html'), currentPath.includes('about')));
        if (identity === 'user') {
            navLinks.appendChild(createUserDropdown(userName, userEmail));
        } else if (identity === 'guestUser') {
            navLinks.appendChild(createGuestDropdown());
        } else {
            navLinks.appendChild(createNavLink('登入', getRelativePath('main/login-user.html'), false, 'loginButton'));
        }
    }
}

function createNavLink(text, href, isActive, id) {
    const a = document.createElement('a');
    a.className = 'nav-link' + (isActive ? ' active' : '');
    a.href = href;
    a.textContent = text;
    if (id) a.id = id;
    return a;
}

function createUserDropdown(userName, userEmail) {
    const dropdown = document.createElement('div');
    dropdown.className = 'user-dropdown';
    dropdown.id = 'userDropdown';
    dropdown.style.display = 'inline-block';
    const userLink = document.createElement('a');
    userLink.href = '#';
    userLink.className = 'user-icon';
    userLink.id = 'userName';
    const displayName = userName || (userEmail ? userEmail.split('@')[0] : '用戶');
    userLink.textContent = `👤 ${displayName}`;
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';
    const profileLink = document.createElement('a');
    profileLink.href = getProfilePath('user');
    profileLink.textContent = '個人資料';
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.id = 'logoutLink';
    logoutLink.textContent = '登出';
    logoutLink.onclick = logout;
    dropdownContent.appendChild(profileLink);
    dropdownContent.appendChild(logoutLink);
    dropdown.appendChild(userLink);
    dropdown.appendChild(dropdownContent);
    return dropdown;
}

function createAdminDropdown(adminName, adminEmail) {
    const dropdown = document.createElement('div');
    dropdown.className = 'user-dropdown';
    dropdown.id = 'userDropdown';
    dropdown.style.display = 'inline-block';
    const userLink = document.createElement('a');
    userLink.href = '#';
    userLink.className = 'user-icon';
    userLink.id = 'userName';
    let displayName = '管理員';
    try {
        if (adminEmail && adminName) {
            const adminObj = typeof adminEmail === 'string' ? JSON.parse(adminEmail) : adminEmail;
            displayName = adminObj.name || '管理員';
        } else if (adminName) {
            displayName = adminName;
        }
    } catch (e) {}
    userLink.textContent = `👤 ${displayName}`;
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';
    const profileLink = document.createElement('a');
    profileLink.href = getProfilePath('admin');
    profileLink.textContent = '個人資料';
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.id = 'logoutLink';
    logoutLink.textContent = '登出';
    logoutLink.onclick = adminLogout;
    dropdownContent.appendChild(profileLink);
    dropdownContent.appendChild(logoutLink);
    dropdown.appendChild(userLink);
    dropdown.appendChild(dropdownContent);
    return dropdown;
}

function createGuestDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'user-dropdown';
    dropdown.id = 'userDropdown';
    dropdown.style.display = 'inline-block';
    const userLink = document.createElement('a');
    userLink.href = '#';
    userLink.className = 'user-icon';
    userLink.id = 'userName';
    userLink.textContent = '👤 訪客';
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';
    
    // 新增註冊帳號選項
    const registerLink = document.createElement('a');
    registerLink.href = getRelativePath('main/user/register.html');
    registerLink.textContent = '註冊帳號';
    
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.id = 'logoutLink';
    logoutLink.textContent = '登出';
    logoutLink.onclick = logout;
    
    dropdownContent.appendChild(registerLink);
    dropdownContent.appendChild(logoutLink);
    dropdown.appendChild(userLink);
    dropdown.appendChild(dropdownContent);
    return dropdown;
}

function getProfilePath(type) {
    const currentPath = window.location.pathname;
    if (type === 'admin') {
        // 根據目前頁面層級產生正確路徑
        if (currentPath.includes('/main/admin/')) return 'profile-admin.html';
        if (currentPath.includes('/main/')) return 'admin/profile-admin.html';
        return 'main/admin/profile-admin.html';
    } else {
        if (currentPath.includes('/test/')) return '../main/user/profile.html';
        if (currentPath.includes('/main/news/')) return '../../main/user/profile.html';
        if (currentPath.includes('/main/')) {
            if (currentPath.includes('/main/user/')) return 'profile.html';
            return 'user/profile.html';
        }
        return 'main/user/profile.html';
    }
}

function getRelativePath(targetPath) {
    const currentPath = window.location.pathname;
    let normalizedTargetPath = targetPath;
    if (!targetPath.startsWith('/')) normalizedTargetPath = '/' + targetPath;
    if (currentPath.includes('/main/user/')) {
        if (normalizedTargetPath.includes('/main/user/')) return normalizedTargetPath.split('/').pop();
        if (normalizedTargetPath.includes('/main/')) return '../' + normalizedTargetPath.split('/main/')[1];
    } else if (currentPath.includes('/main/news/')) {
        return '../../' + normalizedTargetPath.substr(1);
    } else if (currentPath.includes('/test/')) {
        return '../' + normalizedTargetPath.substr(1);
    } else if (currentPath.includes('/main/')) {
        if (normalizedTargetPath.includes('/main/')) return normalizedTargetPath.split('/main/')[1];
        return '../' + normalizedTargetPath.substr(1);
    }
    if (currentPath === '/' || currentPath.includes('/index.html')) return normalizedTargetPath.substr(1);
    const segments = currentPath.split('/').filter(s => s);
    const depth = segments.length - (currentPath.endsWith('/') ? 0 : 1);
    return '../'.repeat(depth) + normalizedTargetPath.substr(1);
}

function logout() {
    // 清除所有登入相關的數據
    sessionStorage.clear();
    localStorage.removeItem('currentTestResult');
    
    // 根據當前頁面位置決定跳轉路徑
    const currentPath = window.location.pathname;
    let redirectPath = '/main/common.html';
    
    if (currentPath.includes('/test/')) {
        redirectPath = '../main/common.html';
    } else if (currentPath.includes('/main/user/')) {
        redirectPath = '../common.html';
    } else if (currentPath.includes('/main/')) {
        redirectPath = 'common.html';
    }
    
    window.location.href = redirectPath;
}

function adminLogout() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('admin');
    sessionStorage.removeItem('adminName');
    sessionStorage.removeItem('adminEmail');
    sessionStorage.setItem('isLoggingOut', 'true');
    // 登出後導向首頁，而不是登入頁面
    window.location.href = getCommonPath(window.location.pathname);
}

function getCommonPath(currentPath) {
    if (currentPath.includes('/main/admin/')) return '../../main/common.html';
    if (currentPath.includes('/main/')) return 'common.html';
    return 'main/common.html';
}

// 初始化與定時刷新
function updateNavbar() {
    renderNavbar();
}

// 為了兼容HTML中的調用，添加updateNavigation函數
function updateNavigation() {
    renderNavbar();
}

document.addEventListener('DOMContentLoaded', function() {
    renderNavbar();
    setInterval(renderNavbar, 5000);
}); 