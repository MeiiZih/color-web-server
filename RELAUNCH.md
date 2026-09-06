# 專案重新上線

這個 repository 同時包含 Express API 與靜態前端，部署一個 Web Service 即可。

## Render 部署

1. 在 MongoDB Atlas 建立資料庫與使用者，並允許 Render 連線。
2. 將本 repository 推送到 GitHub。
3. 在 Render 選擇 **New > Blueprint**，連接 repository；Render 會讀取根目錄的 `render.yaml`。
4. Render 詢問時填入 `MONGODB_URI`，格式例如：
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/survey_db?retryWrites=true&w=majority`
5. 部署完成後開啟 Render 提供的網址；`/health` 回傳 `OK` 即代表服務在線。

`JWT_SECRET` 會由 Render 自動產生。請勿提交 `.env` 或真實資料庫密碼。

## 本機啟動

需要 Node.js 20 或 22，以及可連線的 MongoDB：

```powershell
cd Server
Copy-Item .env.example .env
# 依實際環境設定變數後：
npm ci
npm start
```

目前程式不會自行載入 `.env`；可在 PowerShell 設定 `$env:MONGODB_URI` 等環境變數，或直接使用預設的本機 MongoDB 位址。
