@echo off
echo ========================================
echo 删除文件夹功能快速测试
echo ========================================
echo.

echo 🔧 步骤1: 检查前端服务器
echo.
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2; Write-Host '   ✓ 前端服务器运行正常' } catch { Write-Host '   ✗ 前端服务器未运行' }"
echo.

echo 🔧 步骤2: 测试 Modal 组件
echo.
echo   请在浏览器中访问: http://localhost:5173/test-modal.html
echo   点击测试按钮，确认 Modal 对话框是否能正常显示
echo.

echo 🔧 步骤3: 测试删除文件夹
echo.
echo   1. 访问 http://localhost:5173
echo   2. 使用 admin/admin123 登录
echo   3. 进入资产管理页面
echo   4. 右键点击任意文件夹，选择"删除"
echo   5. 检查是否显示确认删除对话框
echo.

echo 🔧 步骤4: 查看调试信息
echo.
echo   - 按 F12 打开浏览器开发者工具
echo   - 查看 Console 标签页的日志输出
echo   - 应该看到 [FRONTEND] 开头的调试信息
echo.

echo 🔧 步骤5: 如果没有对话框
echo.
echo   可能的原因:
echo   1. 前端服务器没有重启 → 需要重启前端服务器
echo   2. 浏览器缓存问题 → 按 Ctrl+Shift+R 强制刷新
echo   3. JavaScript 错误 → 查看控制台错误信息
echo   4. Modal 被覆盖 → 检查 CSS z-index
echo.

echo 📝 详细诊断指南: DIAGNOSE_MODAL_ISSUE.md
echo.

pause
