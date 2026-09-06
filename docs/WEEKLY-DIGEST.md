# ColorLab 每週資訊待審與摘要信

本機 Codex 每小時補查，本週未整理才执行；需電腦、網路及 Codex 可執行。不是關機仍運作的雲端排程，沒有新增付費服務。
流程：查核官方來源 → 保存 JSON/Markdown → 同步後台待審 → 寄 Email memo → 管理員勾選确认核准 → 發布／更正／下架。
後台入口：https://colorlab-start.onrender.com/app/account.html#content-review

## 資料契約

檔案 tmp/content-review/YYYY-MM-DD.json；weekStart 為 Asia/Taipei 本週星期一日期。
必填 weekStart、checkedAt（實際查核日）、collectionComplete:true、items 陣列；sourceFailures 為查核限制的字串陣列。
items 最多60項，每項必填 action（add/update/remove）、title、reason、sourceName、sourceUrl（已核對的官方 HTTPS 網址）。
update/remove 必填原資訊 targetId（24位ID）；remove 不需 content。
add/update 的 content 必填：
- type：news/common；contentKind：workshop/lecture/article/paper/resource。
- title、sourceName、link：分別與上層 title、sourceName、sourceUrl 完全一致。
- description：自行改寫短摘要，交代對象、時間、地點、費用、名額限制，不複製原文。
- imageUrl：沒有原圖時使用 /assets/images/colorlab-support.svg，由前台依主題選 AI 插畫並標示非官方海報；不要偽稱圖片來自主辦。
- registrationUrl：主辦提供且查核的報名連結，沒有則省略。
- expiresAt：活動必填 ISO 時間。報名截止優先，否則開課時間；時區以台北換算 UTC。
- sourcePublishedAt：已知才填 YYYY-MM-DD，不可用查核日冒充發布日。

來源限官方白名單，新增單位需人工核實後更新 Server/services/contentReview.js。暫時連線失敗不判永久失效；舊文章不因年份早下架。查不到的內容列 sourceFailures，其他查核項可完成本週清單。
每週已同步清單不可修改；同內容跨週去重；沒有候選也可同步空清單。
对照 GET /api/homepage 当前公開資訊；會員資料不在蒐集範圍。

## 憑證與指令

.local/content-review.env 存 CONTENT_REVIEW_INGEST_KEY，需與 Render 後端同名值一致。只能建立待審，不能讀帳號或核准。
.local/colorlab-mail.env 使用既有 BREVO_API_KEY / BREVO_SENDER_EMAIL / BREVO_SENDER_NAME；不更動會員驗證寄信。
兩檔均排除 Git，不得輸出金鑰、貼聊天或提交。收件人由程式固定為授權管理員信箱。

```powershell
node --env-file=.local/content-review.env scripts/sync-content-review.cjs YYYY-MM-DD
node scripts/send-weekly-digest.cjs YYYY-MM-DD --dry-run
node --env-file=.local/colorlab-mail.env scripts/send-weekly-digest.cjs YYYY-MM-DD
```

只有 .sync.json 雜湊與清單一致才能寄信。同步失敗保留原清單重試，不重複新增。
本週 collectionComplete、sync receipt、mail accepted 都具備才完成；缺一項只補該步，不重蒐集。
尚未設定同步憑證時，可到後台手動匯入 JSON，但不宣稱自動同步完成。

## 審核與恢復

管理員登入 → 每週資訊待審 → 原文／報名／前後對照 → 勾選（單次最多60）→ 確認核准或略過。
採真正管理員 JWT 與資料庫身分確認，不以匯入金鑰授權。未核准不公開；略過保留歷史。
整批核准使用 MongoDB transaction；原資訊被別人修改時整批停止，不覆蓋較新內容。
下架標記 archivedAt 並保存原始快照；已核准分頁可恢復。已過期活動恢復後仍不公開，需查核新日期再更正。
既有「首頁資訊」手動刪除不屬於此可恢復審核流程。API 不快取。

## 防重寄

YYYY-MM-DD.mail.json 的 accepted 只代表 Brevo 接受，不保證收件匣已收到。同週不重寄。
sending、uncertain、殘留 .lock 先查平台，不刪紀錄或盲目重送；rejected 每日最多重試一次。
搬移專案需保留清單與 .sync.json、.mail.json。固定收件人，不從來源內容控制。

## 測試

```powershell
node --test Server/tests/weekly-digest.test.cjs
npm.cmd install --prefix tmp/review-qa --no-save mongodb-memory-server@10
node --test Server/tests/content-review.integration.cjs
```

整合測試只啟動隔離本機 MongoDB replica set，首次下載測試用 MongoDB，不接正式資料庫。
涵蓋權限、去重、並行核准、交易回滾、下架恢復與過期過濾。
