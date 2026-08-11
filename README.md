# MH Save Edit

MH3G / MH3U 与 MH4G 存档修改器的统一 Windows 启动和发布仓库。

启动 `MHSaveEditor.exe` 后选择游戏，启动器会从各自独立目录运行对应修改器：

```text
MHSaveEditor/
├─ MHSaveEditor.exe
└─ editors/
   ├─ mh3g/
   │  ├─ MH3USaveEditorGUI.exe
   │  └─ data/
   └─ mh4g/
      ├─ MH4GSaveEditor.exe
      └─ data/
```

两套修改器不会链接进同一个进程。这样可以隔离同名代码、数据集、Qt/OpenSSL
运行库，也能继续分别发布和维护：

- MH3G / MH3U：[`AlexQFMM2/mh3g-saveEdit`](https://github.com/AlexQFMM2/mh3g-saveEdit)
- MH4G：[`AlexQFMM2/mh4g-se`](https://github.com/AlexQFMM2/mh4g-se)

## Windows 构建

推送到 `main` 或手动运行 GitHub Actions 的 `Unified Windows Portable Build`，
即可获得 `MHSaveEditor-windows-portable.zip`。构建使用 `versions.json` 中固定的
两个源码 commit，确保同一次发布可以重复构建。

本地已安装 Qt 5 MinGW 时，也可以只构建启动器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-windows.ps1 `
  -QtBin C:\msys64\mingw64\bin
```

Linux 下可用 Qt 5 检查启动器本身是否能够编译：

```bash
qmake launcher/MHSaveEditor.pro
make -j
```

## 更新内置编辑器版本

修改 `versions.json` 中对应仓库的完整 commit SHA 后推送。本仓库不复制两套
编辑器源码；Action 会按 SHA 拉取、分别调用各自的 Windows 构建脚本，再组装
统一发布包。

修改存档前请备份完整存档目录。
