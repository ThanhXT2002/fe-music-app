# 🚨 Native 504 Timeout Fixes

## Vấn đề hiện tại
- **Web browser**: YouTube download hoạt động OK 
- **Native Android**: Gặp lỗi 504 Gateway Timeout
- **Nguyên nhân**: Native HTTP client có timeout và network stack khác biệt

## 🔍 Nguyên nhân chính

### 1. **HTTP Client khác nhau**
```
Web Browser    → Browser's fetch API (timeout dài)
Native Android → Capacitor HTTP (timeout ngắn hơn)
```

### 2. **Network Stack khác nhau**
```
Web Browser    → Browser network stack
Native Android → Android native network stack
```

### 3. **Timeout Settings**
```
Web Browser    → 45s+ timeout mặc định
Native Android → 30s timeout mặc định
```

## 🛠️ Fixes đã áp dụng

### 1. **Network Interceptor Improvements**
**File**: `src/app/interceptors/network.interceptor.ts`
- ✅ Tăng timeout cho native: 60s (vs 45s cho web)
- ✅ Platform-specific headers
- ✅ Extended retry logic cho 504 errors
- ✅ Keep-alive connections cho native

### 2. **Download Service Enhancements**
**File**: `src/app/services/download.service.ts`
- ✅ Platform detection trong requests
- ✅ Native-specific headers (`X-Platform`, `X-Timeout-Extended`)
- ✅ Enhanced error messages cho 504

### 3. **Android Network Security Config**
**File**: `android/app/src/main/res/xml/network_security_config.xml`
- ✅ Extended trust anchors
- ✅ Proper domain configuration
- ✅ Cleartext traffic permissions

### 4. **Debug Service cho 504**
**File**: `src/app/services/native-504-debug.service.ts`
- ✅ Comprehensive 504 debugging
- ✅ Timeout testing với multiple values
- ✅ Network environment analysis
- ✅ Platform-specific recommendations

## 🧪 Debug Commands

Mở Chrome DevTools trên native app và chạy:

```javascript
// Comprehensive 504 debug
await debug504();

// Get recommendations
get504Recommendations();

// Test basic connectivity
await window.debugNetwork?.testAPIConnectivity();
```

## 📊 Expected Improvements

### Timeout Changes:
```
Before: 30s timeout → 504 errors
After:  60s timeout → Success
```

### Headers Added:
```
X-Platform: android
X-Request-Type: youtube-download
X-Timeout-Extended: true
Connection: keep-alive
Keep-Alive: timeout=60
```

### Retry Logic:
```
Before: 2 retries max
After:  3 retries with exponential backoff
Special handling for 504 errors
```

## 🎯 Next Steps

### 1. **Build & Test**
```bash
ionic build
npx cap sync android
npx cap open android
```

### 2. **Monitor Timeout Performance**
- Test với different network conditions
- Monitor actual response times
- Adjust timeout nếu cần

### 3. **Server-Side Optimizations** (Optional)
Nếu vẫn còn 504, có thể cần:
- Increase server timeout cho YouTube processing
- Add queue system cho long-running requests
- Implement async processing với webhooks

## 🚀 Testing Checklist

- [ ] Build production APK
- [ ] Test trên slow network (3G)
- [ ] Test với various YouTube URLs
- [ ] Monitor Chrome DevTools logs
- [ ] Compare timing: Web vs Native
- [ ] Verify 504 debug commands work

## 📈 Success Metrics

- ✅ Native 504 errors < 5%
- ✅ Average response time < 45s
- ✅ Retry success rate > 80%
- ✅ User experience parity: Web = Native
