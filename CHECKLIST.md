# Checklist: Fix 504 Gateway Timeout cho Native App

## 📋 Checklist hoàn thành

### ✅ Frontend (Ionic/Angular) - COMPLETED
- [x] Cấu hình Android network security (`network_security_config.xml`)
- [x] Cập nhật Android manifest với network permissions
- [x] Tạo network interceptor với timeout settings cho native
- [x] Thêm retry logic với exponential backoff
- [x] Cải thiện error handling trong download service
- [x] Tạo YouTube error analysis service
- [x] Tạo native 504 debug service
- [x] Tạo CORS test service
- [x] Expose debug methods to global window object
- [x] Cập nhật Capacitor config

### ⚠️ Backend (FastAPI) - REQUIRES ACTION
- [ ] **CRITICAL**: Cập nhật CORS configuration để include native origins
- [ ] Restart FastAPI server với config mới
- [ ] Test CORS headers từ native app
- [ ] Kiểm tra server timeout settings

### 🧪 Testing - PENDING
- [ ] Build production version của app
- [ ] Test trên native device/emulator
- [ ] Verify CORS headers trong network requests
- [ ] Test download functionality
- [ ] Validate error handling

## 🚨 ACTION REQUIRED: Backend CORS Fix

### 1. Cập nhật FastAPI CORS Configuration

Trong file FastAPI main (thường là `main.py` hoặc `app.py`):

```python
from fastapi.middleware.cors import CORSMiddleware

# CORS origins đã được cập nhật để support native app
origins = [
    # Web development
    "http://localhost:4800",
    "http://127.0.0.1:4800", 
    "http://localhost:8100",
    "http://127.0.0.1:8100",
    
    # Production web
    "https://tranxuanthanhtxt.com",
    "https://music.tranxuanthanhtxt.com",
    
    # *** CRITICAL: Native app origins ***
    "capacitor://localhost",
    "ionic://localhost", 
    "app://localhost",
    "http://localhost",
    "https://localhost",
    
    # Android WebView
    "file://",
    "content://",
    "android-app://",
    
    # iOS WebView
    "capacitor://",
    "ionic://",
    "app://",
]

# Thêm dải IP LAN
for i in range(2, 255):
    origins.append(f"http://192.168.1.{i}:4800")
    origins.append(f"http://192.168.1.{i}:8100")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    allow_origin_regex=r"^(capacitor|ionic|app)://.*",
    expose_headers=["*"],
    max_age=3600,
)
```

### 2. Restart Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Test Frontend
```powershell
# Run test script
.\test-cors-native.ps1
```

## 🔍 Debug Commands

Sau khi build và run app trên device, mở Chrome DevTools và run:

```javascript
// Test comprehensive network and CORS
debugNetworkAndCors()

// Test chỉ CORS
testCors()

// Test chỉ network connectivity 
debug504()

// Check CORS headers
testCorsHeaders()

// Test multiple server origins
testMultipleOrigins()
```

## 📊 Expected Results

### Before Fix (Current):
- ❌ Status 504 Gateway Timeout
- ❌ CORS policy errors
- ❌ Network requests fail on native

### After Fix (Expected):
- ✅ Successful HTTP requests
- ✅ Proper CORS headers in response
- ✅ Download functionality works
- ✅ No 504 errors

## 🆘 Troubleshooting

### Nếu vẫn có 504 error:
1. Kiểm tra server logs
2. Increase server timeout
3. Test với smaller files first
4. Check server processing time

### Nếu vẫn có CORS error:
1. Verify origins in FastAPI config
2. Check response headers
3. Test with wildcard "*" temporarily
4. Check preflight requests

### Nếu network error:
1. Verify IP address và port
2. Check firewall settings
3. Test server connectivity
4. Check device network connection

## 📁 Files Modified/Created

### New Files:
- `src/app/services/cors-test.service.ts`
- `FASTAPI_CORS_FIX_UPDATED.md`
- `test-cors-native.ps1`
- `CHECKLIST.md` (this file)

### Modified Files:
- `src/app/app.component.ts` (added CORS debug methods)
- `src/app/interceptors/network.interceptor.ts` (timeout + retry)
- `src/app/services/download.service.ts` (error handling)
- `android/app/src/main/res/xml/network_security_config.xml`
- `android/app/src/main/AndroidManifest.xml`

## 🎯 Next Steps

1. **IMMEDIATE**: Update FastAPI CORS config và restart server
2. **BUILD**: Run `.\test-cors-native.ps1` 
3. **TEST**: Use debug commands trong Chrome DevTools
4. **VERIFY**: Download music từ YouTube
5. **MONITOR**: Watch for any remaining errors

---

**Status**: ⚠️ Waiting for backend CORS update
**Priority**: 🔴 HIGH - Production issue
**ETA**: Should be fixed within 1 hour after backend update
