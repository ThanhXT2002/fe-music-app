import { Injectable } from '@angular/core';

// ─────────────────────────────────────────────────────────
// Lớp Đáy Điều Khiển Database Nội Trình Duyệt (IndexedDB DB Service) 
// ─────────────────────────────────────────────────────────

/**
 * IndexedDBService — Dịch vụ nền tảng (Low-level Foundation) tương tác sát phần cứng lõi CSDL nội bộ Browser.
 * 
 * TẠI SAO:
 * - Để thay thế LocalStorage (chỉ lưu 5MB Text rác), thì dùng IndexedDB để lưu Data lên tới hàng chục GB (Blob, JSON).
 * - Được bọc lại toàn bộ phương khức Query thành Async/Await thay thế cho Callback Event DOM lỗi thời rườm rà.
 * - Quản lý chốt mốc Schema Table Model và Schema Version Database.
 */
@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {

  /** Tên định danh Data gốc mảng */
  private dbName = 'xtmusic_db';
  /** 
   * Trạm đánh dấu cấu trúc bản cập nhật CSDL. 
   * Bất cứ khi nào thay đổi Schema bảng Tables, cần phải tăng chỉ số IDB Version này lên mức >= Current.
   */
  private dbVersion = 37;

  /** Con trỏ lưu socket kết xuất Data DB nội đĩa hệ thống OS */
  private db: IDBDatabase | null = null;

  constructor() {}

  // ─────────────────────────────────────────────────────────
  // Khởi Tạo Động Lực SQL Base & Schema Versions.
  // ─────────────────────────────────────────────────────────

  /**
   * Boot khơi thông mở rào mở cổng kết nối Disk Database.
   * Lắng nghe móc nối Update Version tự động (onupgradeneeded).
   */
  async initDB(): Promise<boolean> {
    if (this.db) {
      return true;
    }

    try {
      // Step 1: Kiểm dò phiên bản Version mốc rễ mà đang được cất trong bộ nhớ Client.
      const currentVersion = await this.getCurrentDBVersion();

      // Step 2: Nếu có ai đó (Code Dev update) đẩy móc Version target vọt cao hơn mức cũ, thì mình update lên theo.
      if (currentVersion > this.dbVersion) {
        this.dbVersion = currentVersion + 1;
      }

      return new Promise((resolve) => {
        // Tráp trượt Request Native DB API
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          console.error('Đứt đoạn kết nối IO API CSDL Data IndexedDB:', request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;

          // Schema Integrity Check: Thẩm định xem liệu CSDL vừa load lên có bị đứt bóng cái bảng Stores Table nào chưa không.
          const requiredStores = [
            'songs',
            'search_history',
            'playlists',
            'audioFiles',
            'downloads',
          ];
          const existingStores = Array.from(this.db.objectStoreNames);
          const missingStores = requiredStores.filter(
            (store) => !existingStores.includes(store)
          );

          if (missingStores.length > 0) {
            console.error('Thủng khuyết mất Bảng Object db Schema Structure Tables:', missingStores);
            this.db.close();
            this.db = null; // Trả rỗng bắt huỷ luồng rớt đĩa
            resolve(false);
            return;
          }

          resolve(true); // Vượt mặt tất cả chặn bắt Validation thì Boot Boot xong an toàn
        };

        // Kỹ Thuật DB Lifecycle: Kích Nổ Trigger Tạo Table / Tăng Schema Versions 
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          this.createObjectStores(db);
        };

        // DOM Khóa Đĩa IO báo Block chặn do đang kẹt mở DB ở Tab Trình Duyệt Ngầm Khác (Mở 2 tabs) !!
        request.onblocked = () => {
          console.warn('Blocked: Nâng cấp IndexedDB bị kẹt, Vui lòng đóng hết các Tabs App App phụ xung quanh.');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Crash giật lỗi mảng khi load IO Data base Boot IndexedDB initDB:', error);
      return false;
    }
  }

  /**
   * Tạo Các Cặp Cột Store và Index Table DB Schema. (Tuơng đương thao tác DDL tạo Tables SQL).
   * CHỈ được gọi chập chạy một lần duy nhất lúc Upgrade Versions vòng đời Database (onupgradeneeded).
   */
  private createObjectStores(db: IDBDatabase) {
    // 1. Table bài Hát Music Nhạc Lõi
    if (!db.objectStoreNames.contains('songs')) {
      const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
      // Thêm lưới Index Query (Như khoá Index DB SQL)
      songsStore.createIndex('title', 'title', { unique: false });
      songsStore.createIndex('artist', 'artist', { unique: false });
      songsStore.createIndex('addedDate', 'addedDate', { unique: false });
      songsStore.createIndex('lastPlayedDate', 'lastPlayedDate', { unique: false }); 
    }

    // 2. Table Lịch Sử Query Gõ Kí Tự Chóp Gì Search Gần Nhất
    if (!db.objectStoreNames.contains('search_history')) {
      const historyStore = db.createObjectStore('search_history', {
        keyPath: 'songId',
      });
      historyStore.createIndex('searchedAt', 'searchedAt', { unique: false });
      historyStore.createIndex('title', 'title', { unique: false });
      historyStore.createIndex('artist', 'artist', { unique: false });
    }

    // 3. Table Danh Sách Playlists Các Set Nhạc
    if (!db.objectStoreNames.contains('playlists')) {
      const playlistsStore = db.createObjectStore('playlists', {
        keyPath: 'id',
      });
      playlistsStore.createIndex('name', 'name', { unique: false });
    }

    // 4. Table Disk Binary Lõi Mp3 chứa File Rác File Âm Nhạc Native Offline Blob Files! Trâu mảng dữ nhất.
    if (!db.objectStoreNames.contains('audioFiles')) {
      const audioStore = db.createObjectStore('audioFiles', {
        keyPath: 'songId',
      });
      audioStore.createIndex('mimeType', 'mimeType', { unique: false });
      audioStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 5. Table Jobs Worker Cache Session đang Loading Tải file Offline dở dang giữa đường
    if (!db.objectStoreNames.contains('downloads')) {
      db.createObjectStore('downloads', { keyPath: 'id' });
    }
  }

  /**
   * Health Check: Đảm bảo mạng ống CSDL thông màng luồng chốt, chưa rớt ngầm. 
   * Tránh Request Write Data vô DB khi mà Connection Session đã Die Null.
   */
  async ensureDatabaseReady(): Promise<boolean> {
    if (!this.db) {
      return await this.initDB(); // Kick start again
    }

    try {
      // Soi soi xem Bảng Schema có rớt khuyết hay bị user Reset mất mạng lưới Tables k..
      const requiredStores = [
        'songs',
        'search_history',
        'playlists',
        'audioFiles',
        'downloads',
      ];
      const existingStores = Array.from(this.db.objectStoreNames);
      const missingStores = requiredStores.filter(
        (store) => !existingStores.includes(store)
      );

      if (missingStores.length > 0) {
        console.warn('DB Health Thủng khuyết tables:', missingStores, ' -> Đang Re-Init Reconstruct Table Schema...');
        this.db.close();
        this.db = null;
        return await this.initDB();
      }

      // Kỹ thuật Transaction Test ảo nhử mồi Readonly
      const testTransaction = this.db.transaction(['songs'], 'readonly');
      await new Promise((resolve, reject) => {
        testTransaction.oncomplete = () => resolve(true);
        testTransaction.onerror = () => reject(testTransaction.error);
        testTransaction.onabort = () => reject(new Error('Khắc cờ văng ngắt Transaction Test DB Aborted'));
      });

      return true;

    } catch (error) {
      console.error('Nứt gãy chốt chóp Check Health Ping CSDL chết giấc:', error);
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      return await this.initDB(); // Reborn Init
    }
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Ghi Đọc CSDL Nền (General Abstract CRUD)
  // ─────────────────────────────────────────────────────────

  /**
   * UPDATE & INSERT Record Data Point vô Database (Upsert Command).
   * 
   * LƯU Ý: Rất rủi ro ngẽn Disk do thiết bị Mobile OS RAM ít khi write JSON to bự nén.
   * => Không đặt Timeout chốt ngắt ở đây để chờ Mobile ngâm RAM tự xử Disk Async xong.
   */
  async put(storeName: string, data: any): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('Đứt kết xuất DB nên chặn rạp không cho Put Record mảng mới');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve(true);

        request.onerror = () => {
          console.error(`Crash chập lúc Put Record Write data vào thẻ Table Index ${storeName}:`, request.error);
          resolve(false);
        };

        transaction.onerror = () => {
          console.error(`Gãy ngã lệnh Transaction CSDL ${storeName}:`, transaction.error);
          resolve(false);
        };

        transaction.onabort = () => {
          console.error(`Ngắt chốt giật Aborted rớt mảng Put Cột vào Database ${storeName}`);
          resolve(false);
        };

      } catch (error) {
        console.error(`Rụng báo Throw Exception Put Store ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Kéo Query Trích xuất riêng cụ thể một Object ra Database. (Map Key/Value Record).
   */
  async get(storeName: string, key: string): Promise<any | null> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('Chặn lấy Read Table rớt DB k sẵn sàng ngàm kết nối');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || null);
        
        request.onerror = () => {
          console.error(`Luồng mảng Get Value ID Object Data từ ${storeName} lỗi chặn rẽ xéo:`, request.error);
          resolve(null);
        };

      } catch (error) {
        console.error(`Throw chặn nứt mảng Get Read Data Exception for ${storeName}:`, error);
        resolve(null);
      }
    });
  }

  /**
   * Kéo rút Query Select toàn bộ danh sách Table Row trả mảng Array Data bự múp RAM lên JS (GetAll Object View).
   * Điểm nóng nhức nhối RAM. Tuy nhiên đây là Client Side Database nên đành chịu Fetch Pull toàn cục Array Json!
   */
  async getAll(
    storeName: string,
    indexName?: string,
    query?: IDBValidKey | IDBKeyRange
  ): Promise<any[]> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return [];

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        let request: IDBRequest;
        
        // HACK: Tuỳ biến hỗ trợ Query Lọc Index Range Filter chéo theo cột.
        if (indexName && query) {
          const index = store.index(indexName);
          request = index.getAll(query);
        } else if (indexName) {
          const index = store.index(indexName);
          request = index.getAll();
        } else {
          // Select * From Table 
          request = store.getAll();
        }

        request.onsuccess = () => resolve(request.result || []);
        
        request.onerror = () => {
          console.error(`Nứt Query Lấy GetAll toàn mảng CSDL Array Table ${storeName}:`, request.error);
          resolve([]);
        };

      } catch (error) {
        console.error(`Ném sập Exception Catch List Get All List Record cho mảng rễ ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  /** Lệnh chém giết Drop rụng cụ thể Bản Ghi Delete Record Row */
  async delete(storeName: string, key: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`Đứt kết Delete Record row data chém huỷ ${storeName}:`, request.error);
          resolve(false);
        };
      } catch (error) {
        console.error(`Nứt gãy chốt chém xoá Delete CSDL Table ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /** Format Đặt Wrapper alias Map xoá Delete record nhanh Alias Name. */
  async deleteRecord(storeName: string, key: string): Promise<boolean> {
    return await this.delete(storeName, key);
  }

  /** 
   * Trạm Filter Regex Truy vấn Like Contain tìm chữ chuỗi kí tự động Substring In DB Name String 
   * Bất chấp chữ thường Hoa Hạ - Text Analysis Manual. 
   */
  async search(storeName: string, indexName: string, query: string): Promise<any[]> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return [];

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          // JS Filter Regex Engine lọc theo Text Match Include. Do IndexedDB chưa tích hợp sẵn Like Sql!.
          const filteredResults = results.filter((item) => {
            const value = item[indexName];
            if (typeof value === 'string') {
              return value.toLowerCase().includes(query.toLowerCase());
            }
            return false;
          });
          resolve(filteredResults);
        };
        request.onerror = () => {
          console.error(`Rụng Find Search query In mảng Database ${storeName}:`, request.error);
          resolve([]);
        };

      } catch (error) {
        console.error(`Exception Search Map In Index Store Table Data ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  /** Dập xóa Delete Table (Drop Truncate Xoá sạch toàn bộ rễ Array Items). */
  async clear(storeName: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`Rụng Clear Xoá nát Array DB Data Table Truncate ${storeName}:`, request.error);
          resolve(false);
        };
      } catch (error) {
        console.error(`Exception Đập Xóa Clear Table Array ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /** Ngắt điện TCP RAM DB Disk. Hủy Session Data Pointer */
  closeDB(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /** Trả đếm độ dài Analytics Array Total Length Records Table List Data View. */
  async count(storeName: string): Promise<number> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return 0;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error(`Đứt Gãy Count length DB Table Node ${storeName}:`, request.error);
          resolve(0);
        };

      } catch (error) {
        console.error(`Exception Đếm Length Records Database CSDL Tables List ${storeName}:`, error);
        resolve(0);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Chuyên Môn Ngầm I/O File Audio Binary Blobs Native
  // ─────────────────────────────────────────────────────────

  /**
   * Lưu rễ nhị phân Blob MP3 Audio vô thẻ Table Disk.
   * Áp dụng kĩ thuật Retry Fallback (Thử đi thử lại luân phiên) chống Mobile Error quá tải IO Cấu Hình RAM kẹt IO Ngầm lúc ghi ổ đĩa SSD.
   */ 
  async saveAudioFile(
    songId: string,
    file: File | Blob,
    mimeType: string
  ): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    try {
      // Cast Data Format Web File -> Native Binary Blob
      const blob = file instanceof File ? file : file;

      const audioFile = {
        songId: songId,
        blob: blob,
        mimeType: mimeType,
        size: blob.size,
        createdAt: new Date(),
      };

      // Xoáy Hook Chờ Exponential Backoff Kỹ Thuật (Ngâm 3s rải từ để nhả cháp CPU I/O SSD Đĩa cho Mobile Nóng Máy).
      const result = await this.retryOperation(
        async () => {
          const success = await this.put('audioFiles', audioFile);
          if (!success) throw new Error('Dập rớt rụng IO ghi Disk Audio Put Failed Memory Rác C');
          return success;
        },
        3,
        2000 
      ); 

      if (!result) {
        console.error(`Thất thủ Thất bại Nạp IO thẻ nhớ Audio chóp Cực mạnh vào Record IO Bài nhạc ID: ${songId} (Sau 3 vòng Retries Hỏng Mạng)`);
      }
      return !!result;
    } catch (error) {
      console.error(`Exception Nóng gãy ném lỗi Exception Chặn đĩa IO mảng Audio MP3 Data File Music ID ${songId}:`, error);
      return false;
    }
  }

  /** Trích rút Blob RAM URL */
  async getAudioFile(songId: string): Promise<Blob | null> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return null;

    try {
      const audioFile = await this.get('audioFiles', songId);
      return audioFile ? audioFile.blob : null;
    } catch (error) {
      console.error(`Lỗi Ném Blob get thẻ lấy ra Music Error Cho Audio Trúng bài ID Music Record ${songId}:`, error);
      return null;
    }
  }

  /** Chém rớt file mp3 rỗng giải phóng bộ nhớ */
  async deleteAudioFile(songId: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    try {
      const result = await this.delete('audioFiles', songId);
      if (!result) {
        console.error(`Đứt rụng báo mảng không chém giết huỷ File Audio Offline Data ID Bắt được: ${songId}`);
      }
      return result;
    } catch (error) {
      console.error(`Exception văng rớt Chặn CSD Lỗi Delete Audio Mp3 rác Blob Table Offline Music Record ${songId}:`, error);
      return false;
    }
  }

  /** Xem xét cờ True/False đã tải nhúng file MP3 offline vào Table Blob Audio hay k */
  async hasFile(storeName: string, songId: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    try {
      const file = await this.get(storeName, songId);
      return file !== null;
    } catch (error) {
      console.error(`Check Null Health Gãy IO mảng Database file Nhúng Audio trong Store ${storeName} for Nhạc ID Map ${songId}:`, error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Chặn Kẹt Tải - Đè Session Background Cache Queue!
  // ─────────────────────────────────────────────────────────

  /** Móc đè Trạm Cache mảng Mảng các Task Downloads Loading Dở Gian Tạm thời dán Database Array Jobs! */
  async saveDownloadsToIndexedDB(downloads: any[]): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return false;

    try {
      const downloadsData = {
        id: 'download_tasks',
        downloads: downloads,
        savedAt: new Date(),
      };

      const result = await this.put('downloads', downloadsData);
      if (!result) {
        console.error('Đứt Failed Save Mảng Nhiệm Vụ Downloads Track Cache Đóng vào IndexDB Disk Ổ.');
      }
      return result;
    } catch (error) {
      console.error('Crash gãy RAM Chóp Save Task IO mảng Index Data Download Session List Disk Array Node:', error);
      return false;
    }
  }

  /** Móc Cào Trạm Loads các Data Jobs kẹt List Queue Load tải Nhạc Phục Hồi Start App lại! */
  async loadDownloadsFromIndexedDB(): Promise<any[]> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) return [];

    try {
      const downloadsData = await this.get('downloads', 'download_tasks');
      if (downloadsData && downloadsData.downloads) {
        return downloadsData.downloads;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Crash Cào Trích Móc Array Task Job Download Tải Đè RAM List IndexedDB Disk Fail Rụng CSDL Error:', error);
      return [];
    }
  }

  isReady(): boolean {
    return this.db !== null;
  }

  // ─────────────────────────────────────────────────────────
  // Kĩ Thuật Nén I/O Thông Minh Hệ Điều Hành
  // ─────────────────────────────────────────────────────────

  /**
   * Kỹ Thuật: Retry With Exponential Backoff (Giật Lùi Luỹ Thừa Không Ngừng Ngâm Delay).
   * Tại Sao: File MP3 rất nặng (5-10MB Blob Data). Đẩy trực tiếp cái đùng RAM sang Disk OS Native Browser dễ gây 
   * "DOMException / Memory Allocation Quota Error Chặp Disk". Dùng bộ hoãn xung sẽ cho SSD Android/iOS thở.
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T | null> {
    
    // Test vòng lặp mồi đếm số lần ném try catch!
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(`Gãy Lệnh Action Loop Sau Tổng Các Lần Chờ Disk Try Ngâm Limit ${maxRetries} lần Failed Báo Nóng HDD SSD:`, error);
          return null;
        }

        // Tạo mốc nhân hệ số nhân Delay chờ x2 mũ lên!
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Lệnh I/O Ghi RAM Crash rách (Lần Nhấp Số Quota ${attempt + 1}/${maxRetries}), Delay Thở Nhồi Trễ Retry trong ${delay}ms...`, error);
        
        // Ngủ đông Sleep đè Async nhả Main Thread UI Thread cho Máy chạy trơn lại App Native mượt
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return null;
  }

  /**
   * Đọc rà soát Check Point Bản Vesion cấu trúc mã Schema Table Root.
   */
  private async getCurrentDBVersion(): Promise<number> {
    return new Promise((resolve) => {
      // Nhúng chóp thử Check bằng version 1 để lấy State Info Status Object Tree DB Base.
      const request = indexedDB.open(this.dbName);

      request.onsuccess = () => {
        const db = request.result;
        const currentVersion = db.version;
        db.close();  // Móc Data Version ID Number xong vứt nhả rải Cấp đóng Session Tránh kẹt Node DB Transaction!
        resolve(currentVersion);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Bộ dập Móc Debug Xóa Dev Tool Mảng Web Nền Browser API JS Caches Window Memory Dump Chém Data Test Gỡ App Refresh Re Deploy! 
   */
  async clearBrowserCacheForTesting(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.error('Dập rụng Data Delete Window Cache CSDL Rác Bug Fix Dev Mảng rụng Try Catch Bắt Lỗi:', error);
    }
  }
}
