import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeliveryAttempt, ProofType } from '../../../domain/logistics/logistics.dto';

@Component({
  selector: 'app-proof-detail-drawer',
  templateUrl: './proof-detail-drawer.component.html',
  styleUrl: './proof-detail-drawer.component.scss'
})
export class ProofDetailDrawerComponent {
  @Input() attempt: DeliveryAttempt | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly ProofType = ProofType;

  close(): void {
    this.closed.emit();
  }
}
