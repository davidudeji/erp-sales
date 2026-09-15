import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type VpTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

// Every status in the portal maps to one of these five shapes. The shape
// carries the meaning; tone/color is a reinforcing signal, not the only one —
// so status is still legible in grayscale or to someone with a color vision
// deficiency, and scannable at a glance without reading the label.
//   dot    — active / open / in-flight
//   half   — partially complete / awaiting a decision
//   check  — done / accepted / fulfilled
//   x      — rejected / expired / declined
//   dash   — draft / inactive / withdrawn
export type VpStatusIcon = 'dot' | 'half' | 'check' | 'x' | 'dash' | 'clock';

@Component({
  selector: 'app-vp-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="vp-status" [class]="'vp-status--' + tone">
      <span class="vp-status__icon" aria-hidden="true">
        <svg *ngIf="icon === 'dot'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="4" fill="currentColor" />
        </svg>
        <svg *ngIf="icon === 'half'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path d="M4 0.5A3.5 3.5 0 0 1 4 7.5Z" fill="currentColor" />
        </svg>
        <svg *ngIf="icon === 'check'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="4" fill="currentColor" />
          <path
            d="M2.2 4.1 3.5 5.4 5.9 2.7"
            fill="none"
            stroke="white"
            stroke-width="1.1"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg *ngIf="icon === 'x'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="4" fill="currentColor" opacity="0.16" />
          <path
            d="M2.6 2.6 5.4 5.4M5.4 2.6 2.6 5.4"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
        <svg *ngIf="icon === 'dash'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.6" />
        </svg>
        <svg *ngIf="icon === 'clock'" viewBox="0 0 8 8" width="9" height="9">
          <circle cx="4" cy="4" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path d="M4 2.1V4l1.3 1" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
        </svg>
      </span>
      <span class="vp-status__label">{{ label }}</span>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .vp-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px 4px 8px;
        border-radius: 999px;
        font-size: 0.8125rem;
        font-weight: 600;
        line-height: 1.35;
        white-space: nowrap;
        letter-spacing: 0.01em;
      }
      .vp-status__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      .vp-status--info {
        background: #eaf1fd;
        color: #2461d9;
      }
      .vp-status--success {
        background: #e7f6ef;
        color: #17845a;
      }
      .vp-status--warning {
        background: #fdf1e0;
        color: #b3690a;
      }
      .vp-status--danger {
        background: #fceeed;
        color: #c02c2c;
      }
      .vp-status--neutral {
        background: #eef2f5;
        color: #566670;
      }
      .vp-status--accent {
        background: #dcebf0;
        color: #224957;
      }
    `,
  ],
})
export class VpStatusBadgeComponent {
  @Input() tone: VpTone = 'neutral';
  @Input() icon: VpStatusIcon = 'dot';
  @Input() label = '';
}