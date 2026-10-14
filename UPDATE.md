# 排程更新指引（updater agent）

目標：朝頭早同夜晚各搜尋一次，更新靜態 JSON。**禁止發明分數或球員數據。**

## 範圍

追蹤對象見 `data/players.json`。賽事類型包括：

- 日本國家隊（亞運、VNL、世錦、友誼賽等）
- SV.LEAGUE 男／女
- 海外聯賽：PlusLiga、Serie A1 / SuperLega、Sultanlar Ligi、其他已知球會賽

## 步驟

1. 讀取現有 `data/matches.json`、`data/players.json`、`data/meta.json`、`data/gossip.json`（若有）。
2. Web search（關鍵字例子）：
   - 球員名 + 球會／聯賽 + 最近賽果／下一場
   - `SV.LEAGUE` 今周賽程
   - `PlusLiga Lublin`、`Ziraat Ishikawa`、`UYBA Busto`、`Eczacıbaşı Ishikawa` 等
3. 只採用**有可靠來源**嘅資料（官方聯賽站、球會、可信媒體）。來源互相矛盾就寧願唔更新該欄。
4. Merge 規則：
   - 以 `id` 做鍵；已有場次可更新 `status`、`score`、`setScores`、`playerStats`、`broadcast`、`note`。
   - 新場次：產生穩定 slug `id`（如 `plusliga-zaksa-lublin-2026-10-18`）。
   - `datetime` 用 ISO 8601，**優先 +08:00（HKT）**。
   - `status`：未完 → `upcoming`；完場 → `final`。
   - `playerStats`：**只寫已知數字**；唔知就 `{}` 或唔寫該球員。**永遠唔好估。**
   - `japanPlayers`：只列確認有關嘅日本球員名（同 `players.json` 用名一致為佳）。
5. 更新 `meta.json`：
   - `lastUpdated` → 而家 HKT ISO（例 `2026-10-13T20:00:00+08:00`）
   - 可喺 `sourcesNote` 簡短寫今次來源類型（唔使貼長 URL 列表）。
6. 驗證 JSON 合法（`python3 -m json.tool data/matches.json` 等）。
7. 若 repo 有 git remote：**可 commit** 訊息如 `chore: update matches YYYY-MM-DD AM/PM`；**唔好 force-push**。Push／Pages 由 parent／用戶授權處理。


## 八卦新聞（`data/gossip.json`）

可選：若搵到**有可靠公開來源**嘅球員生活動態／移籍／訪談／社交更新，可 append 到 `gossip.json`。

每項**必須**有可點開嘅原文連結 `sourceUrl`（新聞稿、球會頁、IG／X 帖等）。**搵唔到連結就唔好寫入**——唔好發明八卦，亦唔好無連結就刊登。

欄位建議：
- `id`：穩定 slug（如 `mayu-ecz-first-point-2026-10-11`）
- `date`：`YYYY-MM-DD`（事件／報道日期）
- `title` / `summary`：粵語或繁中均可；摘要唔好誇大
- `playerIds` / `playerNames`：對應 `players.json`
- `tags`：如 `移籍`、`生活`、`訪談`、`出國`
- `source`：媒體／球會名
- `sourceUrl`：**必填**，真實可開嘅 URL

UI 會按 `date` 新到舊排序；性別篩選跟關聯球員。

## 唔好做

- 發明 score / setScores / points / attacks / blocks / serves
- 發明八卦／生活傳聞；無 `sourceUrl` 就唔好加 gossip 項目
- 加後端 API、爬蟲帳密、破解付費牆
- 刪未完場但未開波嘅合理預告（除非官方取消）
- 把未確認傳聞寫成 final

## 建議搜尋清單（每次）

- 石川祐希 / Ziraat Bank
- 高橋藍・小川智大 / Lublin / PlusLiga
- 大塚達宣 / Milano
- 石川真佑 / Eczacıbaşı
- 關菜々巳・和田由紀子・秋本美空 / Busto / Serie A1
- 佐藤淑乃 / Milano 女排
- SV.LEAGUE 今周男／女賽程同賽果（久光、NEC 川崎、大阪等）

## 完成後回報

- 新增／更新咗幾場 upcoming / final
- 邊啲場次因缺可靠來源而跳過
- `lastUpdated` 新值
