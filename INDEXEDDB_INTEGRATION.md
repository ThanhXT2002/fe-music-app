# IndexedDB Integration for Web Platform

## Tổng quan

Dự án **TXT Music** đã được nâng cấp thành công để hỗ trợ cả hai nền tảng:
- **Web Browser**: Sử dụng IndexedDB cho việc lưu trữ dữ liệu
- **Native (Android/iOS)**: Sử dụng SQLite thông qua Capacitor

## Vấn đề ban đầu

Ứng dụng chỉ hoạt động trên nền tảng Android native nhưng gặp lỗi khi chạy trên web browser do:
- Dependency `@capacitor-community/sqlite` chỉ hoạt động trên native platforms
- Dependency `jeep-sqlite` gây xung đột và không tương thích với web environment
- Không có giải pháp lưu trữ dữ liệu cho web platform

## Giải pháp thực hiện

### 1. Loại bỏ jeep-sqlite

```bash
npm uninstall jeep-sqlite
```

**Lý do**: jeep-sqlite gây xung đột và không cần thiết cho giải pháp hybrid.

### 2. Tạo IndexedDBService

Tạo service wrapper cho IndexedDB tại `src/app/services/indexeddb.service.ts`:

```typescript
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbName = 'xtmusic_db';
  private dbVersion = 1;

  // Các object stores (tương đương tables trong SQLite)
  async initDB(): Promise<boolean> {
    // Khởi tạo IndexedDB với các stores: songs, search_history, recently_played
  }

  async put(storeName: string, data: any): Promise<boolean> {
    // Thêm/cập nhật dữ liệu
  }

  async get(storeName: string, key: string): Promise<any> {
    // Lấy dữ liệu theo key
  }

  async getAll(storeName: string): Promise<any[]> {
    // Lấy tất cả dữ liệu từ store
  }

  // ... các methods khác
}
```

### 3. Cập nhật DatabaseService

Sửa đổi `src/app/services/database.service.ts` để hỗ trợ dual platform:

```typescript
export class DatabaseService {
  private platform: string;
  private indexedDB: IndexedDBService;

  constructor(indexedDBService: IndexedDBService) {
    this.indexedDB = indexedDBService;
    this.platform = Capacitor.getPlatform();
    this.initializeDatabase();
  }

  async initializeDatabase() {
    if (this.platform === 'web') {
      // Sử dụng IndexedDB cho web
      await this.indexedDB.initDB();
    } else {
      // Sử dụng SQLite cho native
      // ... existing SQLite logic
    }
  }
}
```

### 4. Cập nhật tất cả database methods

Tất cả các methods trong DatabaseService đã được cập nhật để hỗ trợ cả hai nền tảng:

#### Ví dụ: addSong method

```typescript
async addSong(song: Song): Promise<boolean> {
  if (!this.isDbReady) return false;

  try {
    if (this.platform === 'web') {
      // IndexedDB implementation
      const songData = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        // ... other fields
      };
      return await this.indexedDB.put('songs', songData);
    } else {
      // SQLite implementation
      await this.db.run(
        `INSERT OR REPLACE INTO songs (id, title, artist, ...) VALUES (?, ?, ?, ...)`,
        [song.id, song.title, song.artist, ...]
      );
      return true;
    }
  } catch (error) {
    console.error('Error adding song:', error);
    return false;
  }
}
```

## Các methods đã được cập nhật

### Core Database Methods
- ✅ `initializeDatabase()` - Khởi tạo database theo platform
- ✅ `addSong()` - Thêm bài hát vào thư viện
- ✅ `getAllSongs()` - Lấy tất cả bài hát với sắp xếp
- ✅ `getSongById()` - Lấy bài hát theo ID
- ✅ `searchSongs()` - Tìm kiếm bài hát
- ✅ `toggleFavorite()` - Chuyển đổi trạng thái yêu thích
- ✅ `getFavoriteSongs()` - Lấy danh sách yêu thích

### Search History Methods
- ✅ `addToSearchHistory()` - Thêm vào lịch sử tìm kiếm
- ✅ `getSearchHistory()` - Lấy lịch sử tìm kiếm
- ✅ `searchInHistory()` - Tìm kiếm trong lịch sử
- ✅ `getSearchHistoryItem()` - Lấy item theo ID
- ✅ `markAsDownloaded()` - Đánh dấu đã download
- ✅ `getDownloadedFromHistory()` - Lấy danh sách đã download
- ✅ `deleteFromSearchHistory()` - Xóa khỏi lịch sử
- ✅ `clearSearchHistory()` - Xóa toàn bộ lịch sử
- ✅ `getSearchHistoryStats()` - Lấy thống kê

### Recently Played Methods
- ✅ `addToRecentlyPlayed()` - Thêm vào danh sách nghe gần đây
- ✅ `getRecentlyPlayedSongs()` - Lấy bài hát nghe gần đây

### Utility Methods
- ✅ `clearAllData()` - Xóa tất cả dữ liệu
- ✅ `closeDatabase()` - Đóng kết nối database

## Database Schema

### IndexedDB Object Stores

#### 1. songs
```typescript
{
  keyPath: 'id',
  indexes: ['title', 'artist', 'addedDate']
}
```

#### 2. search_history
```typescript
{
  keyPath: 'songId',
  indexes: ['searchedAt', 'title', 'artist', 'isDownloaded']
}
```

#### 3. recently_played
```typescript
{
  keyPath: 'id',
  autoIncrement: true,
  indexes: ['songId', 'playedAt']
}
```

## Tính năng mới

### 1. Platform Detection
Tự động phát hiện nền tảng và chuyển đổi database backend:
```typescript
this.platform = Capacitor.getPlatform();
// 'web' | 'android' | 'ios'
```

### 2. Data Limitation
Tự động giới hạn dữ liệu để tối ưu performance:
- Search history: Giữ lại 100 items mới nhất
- Recently played: Configurable limit (default 50)

### 3. Error Handling
Xử lý lỗi một cách nhất quán cho cả hai platforms:
```typescript
try {
  // Database operations
} catch (error) {
  console.error('Database error:', error);
  return false;
}
```

## Testing

### Database Test Page
Tạo trang test tại `/database-test` để kiểm tra functionality:

```typescript
// Các test cases:
- Database initialization
- Add/Get songs
- Search functionality
- Search history operations
- Favorite songs
- Recently played
- Data statistics
```

### Cách sử dụng:
1. Truy cập `http://localhost:4801/database-test`
2. Click "Run Tests" để chạy test suite
3. Xem kết quả trong Test Results section

## File Structure

```
src/app/services/
├── database.service.ts       # Service chính với dual platform support
├── indexeddb.service.ts      # IndexedDB wrapper cho web
└── ...

src/app/pages/
├── database-test/            # Test page
│   ├── database-test.page.ts
│   ├── database-test.page.html
│   └── database-test.page.scss
└── ...

src/app/interfaces/
└── song.interface.ts         # Type definitions
```

## Migration Guide

### Từ SQLite-only sang Hybrid:

1. **Không cần thay đổi existing code**: Tất cả methods giữ nguyên signature
2. **Automatic platform detection**: Service tự động chọn backend phù hợp
3. **Data compatibility**: Data structure giống nhau trên cả hai platforms

### Breaking Changes:
- Loại bỏ `jeep-sqlite` dependency
- Cập nhật constructor của `DatabaseService` để inject `IndexedDBService`

## Performance Considerations

### IndexedDB (Web)
- **Pros**: 
  - Native browser support
  - Asynchronous operations
  - Structured data storage
  - Good performance for large datasets

- **Cons**:
  - More complex than localStorage
  - Browser-specific implementations
  - Requires more code for queries

### SQLite (Native)
- **Pros**:
  - Mature and stable
  - SQL query support
  - Better for complex queries
  - Consistent across platforms

- **Cons**:
  - Requires native plugins
  - Not available in web browsers

## Troubleshooting

### Common Issues:

1. **IndexedDB not supported**:
   ```typescript
   if (!window.indexedDB) {
     console.error('IndexedDB not supported');
     // Fallback to localStorage or show error
   }
   ```

2. **Database initialization failed**:
   - Check browser console for IndexedDB errors
   - Verify object store definitions
   - Clear browser data and retry

3. **Data not persisting**:
   - Ensure proper transaction handling
   - Check if data exceeds browser limits
   - Verify put/get operations

## Kết luận

Việc tích hợp IndexedDB đã thành công tạo ra một giải pháp database hybrid mạnh mẽ cho TXT Music:

- ✅ **Web compatibility**: Hoạt động mượt mà trên web browsers
- ✅ **Native support**: Giữ nguyên hiệu suất tốt trên mobile
- ✅ **Code consistency**: Không cần thay đổi business logic
- ✅ **Automatic switching**: Platform detection và backend switching
- ✅ **Data integrity**: Consistent data structure across platforms
- ✅ **Performance optimized**: Proper indexing và data limiting

Ứng dụng giờ đây có thể chạy trên mọi platform mà không cần thay đổi code business logic, đảm bảo trải nghiệm người dùng nhất quán và hiệu suất tối ưu.

---

**Tác giả**: tranxuanthanhtxt2002@gmail.com
**Ngày cập nhật**: 11/06/2025  
**Version**: 1.0.0  
**Platform**: Web + Native Hybrid
