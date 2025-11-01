# 新功能說明 - 測驗管理系統

## 🎯 功能概述

本次更新新增了完整的測驗管理系統，包括：

### 1. 新增資料表結構
- **TestQuestion 模型**: 專門存放問卷題目
  - `testType`: 問卷名稱 (如：色彩性格測驗)
  - `questionNumber`: 題目編號
  - `question`: 題目內容
  - `options`: 選項陣列
  - `totalQuestions`: 該測驗的總題數

### 2. 測驗統計功能
- 根據用戶ID和測驗類型統計該用戶做過幾次該測驗
- 顯示為"第X次測驗"的格式
- 支援查看歷史測驗記錄

### 3. 頁面樣式優化
- 改善測驗結果顯示的視覺效果
- 新增顏色圖標顯示
- 響應式設計支援

## 📁 新增檔案

### 後端檔案
- `Server/models/TestQuestion.js` - 測驗題目資料模型
- `Server/scripts/migrateColorTest.js` - 色彩性格測驗題目遷移腳本
- `Server/scripts/runMigration.js` - 執行遷移的腳本
- `Server/scripts/testAPI.js` - API測試腳本

### 前端檔案
- `color-web/css/user-test.css` - 用戶測驗頁面樣式

## 🔧 API 端點

### 1. 獲取所有測驗類型
```
GET /api/test/types
```

### 2. 獲取指定測驗類型的題目
```
GET /api/test/questions/:testType
```

### 3. 獲取用戶測驗統計
```
GET /api/test/user-stats/:userId?testType=測驗類型
```

### 4. 獲取用戶詳細測驗記錄
```
GET /api/test/user-records/:userId/:testType
```

## 🚀 使用步驟

### 1. 執行資料遷移
```bash
cd Server
node scripts/runMigration.js
```

### 2. 測試API功能
```bash
node scripts/testAPI.js
```

### 3. 啟動伺服器
```bash
npm start
```

## 📊 資料庫結構

### TestQuestion 集合
```javascript
{
  testType: "色彩性格測驗",
  questionNumber: 1,
  question: "1.你在參加大型聚會時，通常是怎樣的人？",
  options: [
    "A. 主動結交新朋友，熱情互動。",
    "B. 帶來歡笑和愉快氣氛。",
    "C. 安靜觀察，不喜歡成為焦點。",
    "D. 喜歡獨自待著，遠離人群。"
  ],
  totalQuestions: 32
}
```

### TestRecord 集合 (現有)
```javascript
{
  userId: ObjectId,
  email: String,
  userName: String,
  testType: String,
  result: String,
  mbtiResult: String,
  colorResult: {
    primary: String,
    secondary: String
  },
  answers: Array,
  timestamp: Date
}
```

## 🎨 頁面功能

### user-test.html 頁面功能
1. **測驗名稱選擇**: 從資料庫動態載入可用的測驗類型
2. **測驗序統計**: 顯示用戶該測驗的完成次數
3. **結果顯示**: 美化的測驗結果展示
4. **個性解析**: 根據MBTI類型顯示詳細的個性分析

## 🔄 後續擴展

此系統設計為可擴展的架構，未來可以：
1. 新增更多測驗類型
2. 自定義測驗題目管理介面
3. 新增測驗結果分析功能
4. 支援測驗結果匯出功能

## 📝 注意事項

1. 確保MongoDB Atlas連接正常
2. 遷移腳本會清空現有的色彩性格測驗題目後重新插入
3. API需要適當的認證機制
4. 前端頁面需要管理員權限才能訪問

## 🐛 故障排除

### 常見問題
1. **資料庫連接失敗**: 檢查MongoDB Atlas連接字符串
2. **API返回404**: 確認路由已正確註冊
3. **前端顯示錯誤**: 檢查瀏覽器控制台的錯誤訊息

### 測試命令
```bash
# 測試資料庫連接
node scripts/testAPI.js

# 重新執行遷移
node scripts/runMigration.js
```
