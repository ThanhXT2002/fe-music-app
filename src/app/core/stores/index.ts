/**
 * Core Stores Layer — Nơi quản lý cục bộ trạng thái toàn cục (State Management).
 *
 * Cách dùng tại components:
 *   import { PlayerStore, LibraryStore } from 'src/app/core/stores';
 */
export { PlayerStore } from './player.store';
export { LibraryStore, type ArtistGroup } from './library.store';
export { DownloadStore } from './download.store';
export { SearchStore } from './search.store';
export { PlaylistStore } from './playlist.store';
export { YtPlayerStore } from './yt-player.store';
