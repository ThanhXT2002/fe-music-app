import { trigger, transition, style, animate, AnimationTriggerMetadata } from '@angular/animations';

/**
 * Metadata Cấu hình kịch bản diễn hoạt chuyển trang.
 * Áp dụng logic hiệu ứng trượt đẩy khối slide up/down từ đáy màn hình.
 * Hook vào Angular Animations Trigger để mượt mà cảm giác trải nghiệm ứng dụng.
 */
export const routeAnimation: AnimationTriggerMetadata = trigger('routeAnimation', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(100%)' }),
    animate('500ms cubic-bezier(.4,0,.2,1)', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('500ms cubic-bezier(.4,0,.2,1)', style({ opacity: 0.5, transform: 'translateY(-90%)' })),
  ]),
]);
