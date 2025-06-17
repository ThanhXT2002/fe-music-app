# Test và Debug CORS cho Native App
# Chạy script này sau khi đã cập nhật CORS configuration trên FastAPI

Write-Host "🚀 Starting CORS Test and Debug Process..." -ForegroundColor Green

# 1. Kiểm tra FastAPI server
Write-Host "`n📡 Checking FastAPI server status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://192.168.1.8:8000/health" -Method GET -TimeoutSec 10
    Write-Host "✅ FastAPI server is running (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ FastAPI server is not accessible!" -ForegroundColor Red
    Write-Host "💡 Make sure FastAPI server is running with updated CORS config" -ForegroundColor Yellow
    Write-Host "   Command: uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
    exit 1
}

# 2. Build production version
Write-Host "`n🔨 Building production version..." -ForegroundColor Yellow
npm run build:prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

# 3. Sync với Capacitor
Write-Host "`n📱 Syncing with Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Capacitor sync completed" -ForegroundColor Green

# 4. Hướng dẫn test manual
Write-Host "`n🧪 Manual Testing Instructions:" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

Write-Host "`n1. Open Android Studio và run app trên device/emulator" -ForegroundColor White
Write-Host "   Command: npx cap open android" -ForegroundColor Gray

Write-Host "`n2. Mở Chrome DevTools để xem logs:" -ForegroundColor White
Write-Host "   - Mở Chrome và vào: chrome://inspect" -ForegroundColor Gray
Write-Host "   - Chọn device và click 'Inspect'" -ForegroundColor Gray

Write-Host "`n3. Run các debug commands trong Console:" -ForegroundColor White
Write-Host "   // Test network connectivity" -ForegroundColor Gray
Write-Host "   debug504()" -ForegroundColor Green
Write-Host ""
Write-Host "   // Test CORS configuration" -ForegroundColor Gray
Write-Host "   testCors()" -ForegroundColor Green
Write-Host ""
Write-Host "   // Check CORS headers" -ForegroundColor Gray
Write-Host "   testCorsHeaders()" -ForegroundColor Green
Write-Host ""
Write-Host "   // Test multiple server origins" -ForegroundColor Gray
Write-Host "   testMultipleOrigins()" -ForegroundColor Green
Write-Host ""
Write-Host "   // Comprehensive network and CORS debug" -ForegroundColor Gray
Write-Host "   debugNetworkAndCors()" -ForegroundColor Green

Write-Host "`n4. Test actual download:" -ForegroundColor White
Write-Host "   - Thử download một bài nhạc từ YouTube" -ForegroundColor Gray
Write-Host "   - Quan sát logs để xem có còn 504 error không" -ForegroundColor Gray

Write-Host "`n🔍 Common Issues và Solutions:" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

Write-Host "`nNếu vẫn gặp 504 error:" -ForegroundColor White
Write-Host "❌ CORS chưa được cập nhật đúng trên FastAPI" -ForegroundColor Red
Write-Host "💡 Solution: Check file FASTAPI_CORS_FIX_UPDATED.md" -ForegroundColor Green

Write-Host "`nNếu gặp network error:" -ForegroundColor White
Write-Host "❌ Device không kết nối được với server" -ForegroundColor Red
Write-Host "💡 Solution: Check IP address và firewall settings" -ForegroundColor Green

Write-Host "`nNếu gặp timeout:" -ForegroundColor White
Write-Host "❌ Server processing quá lâu" -ForegroundColor Red
Write-Host "💡 Solution: Increase timeout settings hoặc optimize server" -ForegroundColor Green

# 5. Auto-open Android Studio (optional)
Write-Host "`n🚀 Opening Android Studio..." -ForegroundColor Yellow
Write-Host "Tip: Chờ build xong rồi test ngay trong device" -ForegroundColor Cyan

try {
    npx cap open android
    Write-Host "✅ Android Studio opened successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not auto-open Android Studio" -ForegroundColor Yellow
    Write-Host "💡 Please run manually: npx cap open android" -ForegroundColor Cyan
}

Write-Host "`n🎉 Setup completed! Ready for testing..." -ForegroundColor Green
Write-Host "📝 Remember to check the debug outputs in Chrome DevTools" -ForegroundColor Cyan
