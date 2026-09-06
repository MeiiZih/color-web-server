# 2026-09-06 首頁專屬插圖更新

## 範圍與來源

本次為 13 篇既有首頁資訊分別生成獨立構圖，取代共用的支持／閱讀／研究／工作坊預設圖。使用內建 image_gen，沒有使用付費 API 或冒充官方海報。圖片是 ColorLab AI 主題示意，不是實際講座、協談、研究參與者或官方機構照片，不表示療效或主辦單位背書。

- 最終檔案：`color-web/assets/images/posts/<slug>-20260906.webp`。
- 原始生成 PNG 保留於本機 Codex generated_images；下表列出原始檔名，便於與本機原檔對照。
- 每張實際生成提示詞、生成日期、產生方式與最終 WebP SHA256 完整登錄於 `Server/data/contentIllustrations.json`；提示詞來源是本次 image_gen 實際呼叫紀錄，不是事後虛構。
- 生成後已由本次整合作業人工檢查主題與獨立構圖。每張使用不同場景，不以改檔名、裁切同圖冒充新插圖。最終 16 張登錄檔案的 SHA256 均不同（含原本 3 張）。
- 不修改公開文章文字、原始來源或管理員圖片。這次部署插圖／來源對應並不核准每週待審貼文。

## 逐篇對應

| 專屬插圖 | 原始文章 | 原始生成 PNG |
| --- | --- | --- |
| `hotline-1925-20260906.webp` | [原文](https://dep.mohw.gov.tw/DOMHAOH/fp-4906-54077-107.html) | `exec-4ecd249d-fa7c-4a7d-b3b5-a679283d2ee0.png` |
| `lifeline-1995-20260906.webp` | [原文](https://www.life1995.org.tw/?aid=2&iid=2) | `exec-1913dbe1-f0e1-464c-a0a0-42fda1677b83.png` |
| `teacher-1980-20260906.webp` | [原文](https://1980.org.tw/service_item_show.php?service_item_id=1) | `exec-0034d693-bdfd-4593-a437-63f5895f26e7.png` |
| `care-guide-20260906.webp` | [原文](https://www.gov.tw/News_Content_26_826198) | `exec-52308930-ba0d-4a39-8233-ecbfdbdfb5a4.png` |
| `psychology-columns-20260906.webp` | [原文](https://www.twtcpa.org.tw/column) | `exec-30d960c6-0079-4fb5-b5ef-2653e90cf631.png` |
| `public-lectures-20260906.webp` | [原文](https://www.twtcpa.org.tw/lecture/public) | `exec-2f629a6b-f4de-433f-a92b-935854d3af1e.png` |
| `digital-research-20260906.webp` | [原文](https://www.nature.com/articles/s41562-026-02415-6) | `exec-6d6046ca-da17-42cf-b5e5-0e1c90bfdfff.png` |
| `inner-child-20260906.webp` | [原文](https://www.1980.org.tw/course_show.php?course_id=660) | `exec-fa68b0ba-59b7-4b90-879c-046663a4db7a.png` |
| `psychology-knowledge-20260906.webp` | [原文](https://www.tpa-tw.org/news) | `exec-ecb6b7d2-a2ba-4acf-8263-49fdd2abb8bb.png` |
| `youth-text-20260906.webp` | [原文](https://www.life1995.org.tw/?aid=301&iid=169&page_name=detail) | `exec-533898fd-8fba-4912-8bd8-5bfc724f8c36.png` |
| `healthy-boundaries-20260906.webp` | [原文](https://www.1980.org.tw/news_show.php?news_id=830) | `exec-0aefca3c-5ddc-4769-8267-cae75a65130a.png` |
| `relationship-pause-20260906.webp` | [原文](https://1980.org.tw/news_show.php?news_id=832) | `exec-fe9ca81d-8cbd-46e2-9a2e-167c0d8422fe.png` |
| `social-emotional-ai-20260906.webp` | [原文](https://www.tpa-tw.org/2026submission-registration) | `exec-297ddfbe-c29c-4f4a-8256-a8452b864529.png` |

## 既有插圖與失敗處理

- `counseling-20260906.webp` 原本即為同一篇「115 年青壯世代心理健康支持方案」生成，僅對應該篇，不借用到政府指南等其他文章。
- 原本 `empathy-20260906.webp` 僅屬於同理心工作坊（course_id=719）；`workplace-20260906.webp` 僅屬於公會「安靜離職」文章（column/2996）。兩者保留，不跨貼文使用。
- `color-web/app/content-illustrations.mjs` 以來源主機、路徑與排序後查詢參數建立穩定對應；忽略追蹤參數。
- 管理員提供的圖片仍優先。既有官方原圖可保留，載入失敗僅顯示該篇專屬示意圖。
- 六篇仍有可讀專屬來源圖片的舊內容不更換原圖；沒有登錄專屬示意圖時，載入中／失敗只顯示中性說明，不能借用其他貼文圖片。
- 專屬示意圖本身失敗時，移除破圖並保留查看原文功能，不再補上共用圖。

## 驗證

`scripts/check-content-media.cjs` 已在本機 390 / 1280 寬度通過：14 篇映射不重複、管理員圖片優先、自有生成圖不借用他圖、官方原圖失敗顯示該篇示意、來源／插圖皆失敗的中性狀態、布局與圖片解碼。四張既有官方原圖均成功載入；另人工檢視最新資訊、一般資訊及三張專線卡片截圖。16 張登錄圖片均核對實際 SHA256 一致。本文不代表已部署或完成 iPhone 實機驗收。
