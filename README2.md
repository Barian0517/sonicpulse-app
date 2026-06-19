# SonicPulse Developer Notes & Internal Docs 🛠️

本文件記錄了 SonicPulse 的架構設計、開發注意事項及未來規劃。

## 🏗️ 技術棧 (Tech Stack)

- **Core**: [Tauri v2](https://v2.tauri.app/) (Rust 核心)
- **Frontend**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) + [Lucide Icons](https://lucide.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Audio Processing**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## 📂 專案結構

- `/src-tauri`: Rust 核心邏輯與權限設定。
  - `capabilities/default.json`: 視窗管理與進程權限。
- `/src/components`:
  - `Visualizer.tsx`: 核心 Canvas 渲染邏輯，處理所有幾何變換。
  - `Player.tsx`: 檔案播放清單管理與 UI。
  - `Controls.tsx`: 設定面板，包含 BroadcastChannel 通訊。
- `/src/types.ts`: 全域類型定義。

## 🔑 關鍵機制說明

### 1. 懸浮窗 (Overlay) 生命週期
- 使用 `WebviewWindow` API 建立。
- **通訊**：透過 `BroadcastChannel` (`sonicpulse_overlay_state`) 進行主副視窗間的狀態同步（如：鎖定/解鎖、關閉請求）。
- **持久化**：位置 (X, Y) 與大小 (W, H) 儲存在 `localStorage`，於啟動時讀取並使用 `set_position`/`set_size`。
- **自動關閉**：主視窗監聽 `onCloseRequested`，觸發時會強行銷毀懸浮窗 Webview 實例。

### 2. 音訊渲染流水線
- **Source**: `MediaElementSource` (檔案) 或 `MediaStreamSource` (麥克風/系統)。
- **Analyser**: `fftSize` 設定為 `32768` 以支援精細的頻譜分析。
- **Output**: 透過 `GainNode` 控管監聽開關，避免系統音訊回授 (Feedback)。

### 3. CI/CD 與版本控制
- **GitHub Actions**: 使用 `tauri-apps/tauri-action` 進行自動打包。
- **自動版本號**：在 `publish.yml` 中使用 Node.js 腳本動態修改 `tauri.conf.json` 的版本為 `0.1.${{ github.run_number }}`，確保每個 Release 標籤唯一。

## 📝 待辦清單 (TODO)

- [ ] **效能優化**：將視覺化計算移至 Web Worker (OffscreenCanvas)。
- [ ] **更多形狀**：實作 3D 碎形 (Fractals) 或 粒子流 (Particle Flow)。
- [ ] **多端點輸出**：支援同時向多個音訊裝置輸出。
- [ ] **設定雲端備份**：整合 GitHub Gist 或雲端同步設定。

## ⚠️ 開發陷阱 (Gotchas)

- **跨域 (CORS)**：導入音樂檔案時必須使用 `URL.createObjectURL`，否則 Canvas `captureStream` 可能因汙染 (Tainted Canvas) 無法錄製。
- **Windows 版本限制**：Windows 的 MSI/NSIS 打包器只接受 `x.y.z` 格式，不支援 `pre-release` 標籤（如 `-alpha`）。
- **平台兼容性**：目前僅對 Windows 平台進行深度優化與測試。macOS/Linux 因權限與音訊驅動差異，目前仍不穩定。

---
*Last Updated: 2026-05-11*
