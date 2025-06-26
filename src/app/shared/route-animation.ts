import { trigger, transition, style, animate, AnimationTriggerMetadata } from '@angular/animations';

export const routeAnimation: AnimationTriggerMetadata = trigger('routeAnimation', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(100%)' }),
    animate('500ms cubic-bezier(.4,0,.2,1)', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('500ms cubic-bezier(.4,0,.2,1)', style({ opacity: 0.5, transform: 'translateY(-90%)' })),
  ]),
]);
