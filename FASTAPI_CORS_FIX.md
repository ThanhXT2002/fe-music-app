# Sửa CORS FastAPI cho Native App

## Vấn đề
Native app (Capacitor) sử dụng các origin đặc biệt mà CORS hiện tại không cho phép:
- `capacitor://localhost`
- `app://localhost`
- `ionic://localhost`

## Giải pháp

### 1. Cập nhật CORS Origins
```python
# Set up CORS
origins = [
    # Web origins
    "http://localhost:4800",
    "http://127.0.0.1:4800", 
    "http://localhost:8100",
    "http://127.0.0.1:8100",
    "https://tranxuanthanhtxt.com",
    "https://music.tranxuanthanhtxt.com",
    
    # Native app origins (Capacitor)
    "capacitor://localhost",
    "app://localhost", 
    "ionic://localhost",
    "file://",
    
    # Cho phép null origin (đôi khi native app gửi)
    "null",
]

# Thêm dải IP LAN
for i in range(2, 255):
    origins.append(f"http://192.168.1.{i}:4800")
    origins.append(f"http://192.168.1.{i}:8100")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Cách debug origin trên server
Thêm middleware để log origin của request:

```python
@app.middleware("http")
async def log_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    user_agent = request.headers.get("user-agent", "")
    print(f"Request from origin: {origin}, User-Agent: {user_agent}")
    response = await call_next(request)
    return response
```

### 3. Tùy chọn: Cho phép tất cả origins (chỉ dùng cho test)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # CHỈ DÙNG CHO TEST!
    allow_credentials=False,  # Phải False khi dùng allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Kiểm tra
1. Cập nhật CORS trên server FastAPI
2. Restart server
3. Build lại native app và test
4. Kiểm tra log server để xem origin nào được gửi từ native app
