@echo off
echo ========================================
echo DifyFlow 文件夹删除功能测试脚本
echo ========================================
echo.

echo 1. 检查后端服务器状态...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing; Write-Host '   ✓ 后端服务器运行正常' } catch { Write-Host '   ✗ 后端服务器未运行，请先启动后端' }"
echo.

echo 2. 检查前端服务器状态...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2; Write-Host '   ✓ 前端服务器运行正常' } catch { Write-Host '   ✗ 前端服务器未运行，请先启动前端' }"
echo.

echo 3. 测试步骤：
echo    a) 访问 http://localhost:5173
echo    b) 使用 admin/admin123 登录
echo    c) 进入资产管理页面
echo    d) 创建测试文件夹（如"test-delete"）
echo    e) 上传几个文件到该文件夹
echo    f) 右键点击文件夹，选择"删除"
echo    g) 确认删除对话框
echo.

echo 4. 调试信息：
echo    - 后端日志查看后端控制台
echo    - 前端日志按F12打开浏览器开发者工具
echo    - 详细调试指南见 DEBUG_FOLDER_DELETE.md
echo.

echo 5. 如果删除失败：
echo    - 确保后端服务器已重启（加载最新代码）
echo    - 检查后端控制台的详细日志
echo    - 检查浏览器控制台的错误信息
echo.

pause
