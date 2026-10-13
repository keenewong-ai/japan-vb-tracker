# 日本排球賽事追蹤（japan-vb-tracker）

靜態網站：列出日本男／女排相關球員（國家隊＋海外／SV 球會）即將賽事、過往賽果，以及已知嘅每場數據。

**冇後端 API。** 數據係 `data/*.json`，靠朝頭早／夜晚搜尋更新。

## 本地預覽

唔好用 `file://` 直接開（`fetch` 會失敗）。用任一靜態伺服器：

```bash
cd /workspace/japan-vb-tracker
python3 -m http.server 8080
# 然後瀏覽器開 http://localhost:8080/
```

或者：

```bash
npx --yes serve .
```

## GitHub Pages

1. 將呢個資料夾推上 repo（例如 `japan-vb-tracker`），或放喺 repo 嘅 `/docs` / `gh-pages` branch。
2. Settings → Pages → Source 揀對應 branch／folder。
3. 網站會讀相對路徑 `data/matches.json`、`data/players.json`、`data/meta.json`。

Parent agent 負責 auth／push；本專案本身唔會 push。

## 數據檔

| 檔案 | 用途 |
|------|------|
| `data/matches.json` | 賽事列表（upcoming / final） |
| `data/players.json` | 追蹤中球員 |
| `data/meta.json` | `lastUpdated`、來源說明 |

規則：**唔知就留空**，尤其 `playerStats` 同 `score` / `setScores` — **禁止估分**。

## 更新流程

見 [UPDATE.md](./UPDATE.md)。建議 cron／agent：每日朝頭早同夜晚各跑一次搜尋 → merge JSON →  bump `meta.lastUpdated`。

## UI

- 分頁：即將開波｜過往賽果｜球員
- 篩選：全部／男排／女排
- 撳賽事卡片睇詳情同球員數據
- 時間顯示為香港時間（HKT / Asia/Hong_Kong）
