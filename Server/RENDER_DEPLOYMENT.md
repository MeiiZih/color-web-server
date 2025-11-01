# Render 部署說明

本文件說明如何將此專案部署到 Render 平台。

## 📋 前置準備

1. **GitHub 帳號**：將程式碼推送到 GitHub
2. **Render 帳號**：在 [render.com](https://render.com) 註冊帳號
3. **MongoDB Atlas**：準備好資料庫連線字串

## 🔧 環境變數設定

在 Render 的控制面板中，進入你的 Web Service，點選 **Environment** 標籤，添加以下環境變數：

### 必須的環境變數

```
MONGODB_URI=mongodb+srv://使用者名稱:密碼@cluster名稱.mongodb.net/survey_db
JWT_SECRET=你的密鑰字串（建議使用長且隨機的字串）
NODE_ENV=production
```

### 可選的環境變數

```
PORT=3000
```
> **注意**：PORT 通常由 Render 自動設定，不需要手動配置

## 🚀 部署步驟

### 步驟 1：連接 GitHub Repository

1. 登入 Render 控制面板
2. 點選 **New +** → **Web Service**
3. 選擇 **Connect GitHub**，並授權 Render 存取你的 GitHub
4. 選擇你的 Repository（應包含 Server 資料夾的專案）

### 步驟 2：設定 Build 和 Start 指令

在 Render 的服務設定中：

- **Name**: 為你的服務命名（例如：color-web-server）
- **Environment**: 選擇 **Node**
- **Build Command**: 
  ```bash
  cd Server && npm install
  ```
- **Start Command**: 
  ```bash
  cd Server && npm start
  ```
- **Root Directory**: 
  ```
  Server
  ```

### 步驟 3：設定環境變數

在 **Environment Variables** 區塊中，添加前面提到的環境變數：
- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV=production`

### 步驟 4：部署設定

- **Plan**: 選擇免費方案（Free）或付費方案
- **Region**: 選擇離你最近的區域（例如：Singapore）
- **Branch**: 通常為 `main` 或 `master`

### 步驟 5：部署

點選 **Create Web Service**，Render 會自動：
1. 拉取你的程式碼
2. 執行 `npm install`
3. 啟動伺服器

部署完成後，你會得到一個網址，例如：`https://your-app-name.onrender.com`

## 📁 專案結構

確保你的 GitHub Repository 結構如下：

```
your-repo/
├── Server/
│   ├── server.js          # 主伺服器檔案
│   ├── package.json       # 相依套件
│   ├── config/
│   │   └── db.js          # 資料庫連線
│   ├── models/            # 資料模型
│   ├── routes/            # API 路由
│   └── uploads/           # 上傳檔案目錄（會自動建立）
└── color-web/             # 前端靜態檔案
    ├── index.html
    ├── main/
    └── js/
```

## ⚠️ 重要注意事項

### 1. 資料庫連線

- 確保 MongoDB Atlas 的網路設定允許來自任何 IP 的連線（在 MongoDB Atlas 的 Network Access 中設定 `0.0.0.0/0`）
- 或者添加 Render 的 IP 到白名單

### 2. 圖片上傳

- Render 使用**短暫儲存**（ephemeral storage）
- 上傳的圖片在服務重啟後會消失
- 建議將來改用雲端儲存服務（如 AWS S3、Cloudinary）

### 3. 靜態檔案路徑

- `server.js` 中已設定正確的靜態檔案路徑
- 確保 `color-web` 資料夾在 `Server` 的上層目錄

### 4. 環境變數安全性

- **不要**將敏感資訊（如資料庫密碼、JWT_SECRET）推送到 GitHub
- 使用 Render 的環境變數功能來儲存這些資訊

### 5. CORS 設定

- 目前設定為允許所有來源（`origin: '*'`）
- 如果要在生產環境限制，可以在 `server.js` 中修改 CORS 設定

## 🔍 故障排除

### 問題：無法連接資料庫

**解決方案**：
1. 檢查 MongoDB Atlas 的連線字串是否正確
2. 確認 MongoDB Atlas 的 Network Access 設定
3. 檢查 Render 的環境變數是否正確設定

### 問題：圖片無法顯示

**解決方案**：
1. 確認 `uploads/homepage` 目錄已建立
2. 檢查圖片路徑是否正確（應為 `/uploads/homepage/檔名`）
3. 注意 Render 的短暫儲存限制

### 問題：前端無法呼叫 API

**解決方案**：
1. 確認前端使用相對路徑（已更新所有前端檔案）
2. 檢查 CORS 設定
3. 查看瀏覽器的 Console 是否有錯誤訊息

### 問題：無法登入

**解決方案**：
1. 檢查 JWT_SECRET 環境變數是否設定
2. 確認資料庫中有管理員帳號
3. 查看 Render 的 Logs 以了解錯誤詳情

## 📝 檢查清單

部署前確認：

- [ ] GitHub Repository 已準備好
- [ ] MongoDB Atlas 資料庫已設定並可連線
- [ ] 環境變數已準備（MONGODB_URI, JWT_SECRET）
- [ ] `package.json` 中的 `start` 指令正確
- [ ] `.gitignore` 已排除 `node_modules`
- [ ] 所有前端 API 路徑已更新為相對路徑

## 🎉 部署成功後

1. 訪問你的 Render 網址
2. 測試登入功能
3. 測試首頁資訊顯示
4. 測試測驗功能
5. 檢查所有功能是否正常運作

---

如有問題，請查看 Render 的 Logs 或聯繫技術支援。

