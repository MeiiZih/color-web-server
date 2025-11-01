# 色彩心理測驗網站

## 本地開發環境設置

### 1. 安裝 MongoDB

首先，您需要在本地機器上安裝 MongoDB:

1. 訪問 [MongoDB 下載頁面](https://www.mongodb.com/try/download/community)
2. 下載適合您作業系統的 MongoDB Community Server
3. 按照安裝指南完成安裝

### 2. 啟動 MongoDB 服務

確保 MongoDB 服務正在運行:

**Windows:**
```
"C:\Program Files\MongoDB\Server\{版本號}\bin\mongod.exe" --dbpath="C:\data\db"
```

> 注意: 您需要先創建 `C:\data\db` 目錄，或者指定其他目錄作為 `--dbpath`。

**macOS/Linux:**
```
mongod --dbpath /data/db
```

### 3. 啟動應用程序

開發環境 (使用本地 MongoDB):
```
npm run dev
```

生產環境 (使用遠程 MongoDB):
```
npm run prod
```

## 資料庫問題排解

### 資料庫重啟後數據丟失問題

如果在關機後數據丟失，請確保:

1. MongoDB 服務已正確安裝並設置為自動啟動
2. 本地開發時使用 `npm run dev` 命令啟動服務器，確保連接本地數據庫
3. 資料庫存儲路徑 (`--dbpath`) 正確設置並有適當的權限

### 切換本地/遠程數據庫

- 本地開發: `npm run dev` (連接 localhost:27017)
- 生產環境: `npm run prod` (連接 20.57.128.97:27017)

## 部署到虛擬機

當準備將應用程序部署到虛擬機時:

1. 確保虛擬機上已安裝並運行 MongoDB
2. 使用 `npm run prod` 或 `NODE_ENV=production node server.js` 啟動服務器
3. 應用將自動連接到虛擬機的 MongoDB (20.57.128.97) 