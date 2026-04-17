/**
 * Core API Layer — File điểm trảo xuất (Barrel File) giúp export gom nhóm các dịch vụ thuần HTTP 
 * (Các dịch vụ API trong đây tuyệt đối tối giản, không giữ state tuỳ ý, đảm nhận pure network calls).
 */
export { MusicApiService } from './music-api.service';
export { YtMusicService } from './ytmusic.service';
export { HomeService } from './home.service';
export { HealthCheckService } from './health-check.service';
export { SongIdentifyApiService } from './song-identify-api.service';
