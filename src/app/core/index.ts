/**
 * Core module — Điểm trảo xuất (Barrel File) trung tâm cho tầng lõi (Core layer) của toàn bộ ứng dụng.
 *
 * Kiến trúc tổng thể: API → Store → Component
 *
 * Mẫu import sử dụng:
 * @example
 * import { PlayerStore, Song, formatTime } from '@core';
 */

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

export * from './stores';
export * from './services';
export * from './api';
export * from './data';
export * from './platform';
export * from './ui';
export * from './interfaces';
export * from './utils';
export * from './interceptors';
