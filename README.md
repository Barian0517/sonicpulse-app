# SonicPulse Visualizer

一個基於 Tauri + React + Vite 開發的高效能音訊視覺化工具。

## 🚀 開發環境配置

### 重要修正：埠號設定
- **Vite 埠號**: `3000` (設定於 `vite.config.ts`)
- **Tauri DevUrl**: `http://localhost:3000` (設定於 `src-tauri/tauri.conf.json`)
> **注意**: 如果修改了 Vite 的埠號，必須同步更新 `tauri.conf.json` 中的 `devUrl`，否則開發模式下視窗將無法啟動。

### Rust 環境變數 (Windows)
若在終端機無法執行 `cargo` 或 `rustc`，請執行以下 PowerShell 指令（管理員權限）：
```powershell
[System.Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:USERPROFILE\.cargo\bin", [System.EnvironmentVariableTarget]::User)
```

## 🛠️ 常用指令

### 開發模式
啟動 Vite 開發伺服器與 Tauri 視窗：
```bash
npx tauri dev
```

### 本地打包 (.exe)
編譯並打包 Windows 執行檔與安裝程式：
```bash
npx tauri build
```
- **執行檔位置**: `src-tauri/target/release/app.exe`
- **安裝程式位置**: `src-tauri/target/release/bundle/nsis/sonicpulse-visualizer_x64-setup.exe`

## 📦 GitHub Actions 自動化發布

本專案已配置 GitHub Actions (`.github/workflows/tauri-release.yml`)，支援自動打包 Windows、Linux 與 macOS 版本。

### 如何觸發發布流：
1.  **更新版本號**: 修改 `package.json` 中的 `"version"`。
2.  **推送標籤 (Tag)**:
    ```bash
    git tag v0.1.0  # 替換成你的版本號
    git push origin v0.1.0
    ```
3.  **檢查 Release**: 前往 GitHub 倉庫的 **Releases** 頁面，Actions 會在完成後自動將產出的檔案上傳至該處（約 15-20 分鐘）。

## 🔧 Linux 編譯依賴
若要在 Linux 環境本地編譯，需先安裝以下套件：
```bash
sudo apt update
sudo apt install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev build-essential
```

## 📝 技術筆記
- **Identifier**: 專案標示符已更改為 `com.sonicpulse.visualizer`，請勿隨意更動以免導致打包失敗。
- **透明視窗**: 覆蓋模式 (Overlay) 已在 `App.tsx` 中實作，支援透明背景與滑鼠穿透設定。
