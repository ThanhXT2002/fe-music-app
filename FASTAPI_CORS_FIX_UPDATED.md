# Cấu hình CORS FastAPI cho Native App (Ionic/Capacitor)

## Vấn đề hiện tại
Cấu hình CORS hiện tại chỉ hỗ trợ web origins (http://localhost, IP LAN) nhưng thiếu origins cho native app.

## Cấu hình CORS đã sửa

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Set up CORS - Đã thêm origins cho native app
origins = [
    # Web development origins
    "http://localhost:4800",
    "http://127.0.0.1:4800", 
    "http://localhost:8100",
    "http://127.0.0.1:8100",
    
    # Production web origins
    "https://tranxuanthanhtxt.com",
    "https://music.tranxuanthanhtxt.com",
    
    # Native app origins (Ionic/Capacitor)
    "capacitor://localhost",
    "ionic://localhost", 
    "app://localhost",
    "http://localhost",
    "https://localhost",
    
    # Android WebView origins
    "file://",
    "content://",
    "android-app://",
    
    # iOS WebView origins  
    "capacitor://",
    "ionic://",
    "app://",
    
    # Wildcard cho development (chỉ nên dùng trong development)
    # "*"  # Uncomment này nếu vẫn gặp vấn đề CORS
]

# Thêm dải IP LAN cho web development
for i in range(2, 255):
    origins.append(f"http://192.168.1.{i}:4800")
    origins.append(f"http://192.168.1.{i}:8100")

# Thêm CORS middleware với cấu hình mở rộng
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    allow_origin_regex=r"^(capacitor|ionic|app)://.*",  # Regex cho native origins
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests
)

# Thêm middleware để log CORS requests (debug)
@app.middleware("http")
async def cors_debug_middleware(request, call_next):
    origin = request.headers.get("origin")
    print(f"🌐 Request from origin: {origin}")
    print(f"🔍 Request headers: {dict(request.headers)}")
    
    response = await call_next(request)
    
    print(f"✅ Response status: {response.status_code}")
    print(f"📤 Response headers: {dict(response.headers)}")
    
    return response
```

## Cấu hình bổ sung cho Production

Nếu vẫn gặp vấn đề, thêm cấu hình này:

```python
# Cấu hình CORS rộng hơn cho production (nếu cần)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả origins
    allow_credentials=False,  # Phải set False khi dùng "*"
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Kiểm tra và Test

1. **Restart FastAPI server** sau khi cập nhật:
   ```bash
   # Stop server hiện tại
   # Restart với cấu hình mới
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Kiểm tra logs** khi native app gửi request:
   - Origin header từ native app
   - CORS headers trong response

3. **Test với debug methods** đã tạo trước đó:
   ```javascript
   // Trong browser console của native app
   window.debugNative504();
   window.testConnectivity();
   ```

## Lưu ý quan trọng

- **Native app origins** khác hoàn toàn với web origins
- **Capacitor/Ionic** sử dụng custom protocols như `capacitor://`
- **Android WebView** có thể sử dụng `file://` hoặc `content://`
- **CORS preflight** có thể cần cache để tránh timeout

## Nếu vẫn gặp vấn đề

1. Thử **tắt CORS hoàn toàn** để test:
   ```python
   # Temporary - chỉ để test
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],
       allow_credentials=False,
       allow_methods=["*"], 
       allow_headers=["*"],
   )
   ```

2. Kiểm tra **server timeout settings**:
   ```python
   # Tăng timeout cho uvicorn
   uvicorn main:app --timeout-keep-alive 120 --timeout-graceful-shutdown 60
   ```

3. Thêm **custom headers** handling:
   ```python
   @app.middleware("http")
   async def add_cors_headers(request, call_next):
       response = await call_next(request)
       
       response.headers["Access-Control-Allow-Origin"] = "*"
       response.headers["Access-Control-Allow-Methods"] = "*"
       response.headers["Access-Control-Allow-Headers"] = "*"
       response.headers["Access-Control-Max-Age"] = "3600"
       
       return response
   ```
