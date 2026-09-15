// rfq-template-selector.component.ts

import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RFQTemplate } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest, parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { MessageService } from 'primeng/api';

import { RFQTemplateSection } from '../../../domain/procurement-request/procurement.dto';

const makeSection = (id: string, title: string, type: RFQTemplateSection['type'], order: number): RFQTemplateSection => ({
  id, title, type, content: '', order, isVisible: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FALLBACK_TEMPLATES: any[] = [
  {
    id: 'TMPL-STANDARD',
    name: 'Standard Professional',
    description: 'Clean, professional layout with company header, item table, subtotals, and footer. Ideal for most procurement requests.',
    layout: 'STANDARD',
    isDefault: true,
    sections: [
      makeSection('s1', 'Header', 'HEADER', 1),
      makeSection('s2', 'Details', 'DETAILS', 2),
      makeSection('s3', 'Items', 'ITEMS', 3),
      makeSection('s4', 'Terms', 'TERMS', 4),
      makeSection('s5', 'Footer', 'FOOTER', 5),
    ],
  },
  {
    id: 'TMPL-PREMIUM',
    name: 'Premium Branded',
    description: 'Full-featured document with "Prepared For / By" sections, project title banner, payment details, T&Cs, and amount in words.',
    layout: 'CORPORATE',
    isDefault: false,
    sections: [
      makeSection('p1', 'Header', 'HEADER', 1),
      makeSection('p2', 'Details', 'DETAILS', 2),
      makeSection('p3', 'Items', 'ITEMS', 3),
      makeSection('p4', 'Terms', 'TERMS', 4),
      makeSection('p5', 'Footer', 'FOOTER', 5),
    ],
  },
  {
    id: 'TMPL-MINIMAL',
    name: 'Minimal Clean',
    description: 'Stripped-down format — just the essentials. Best for quick internal RFQs where simplicity is preferred.',
    layout: 'MINIMAL',
    isDefault: false,
    sections: [
      makeSection('m1', 'Header', 'HEADER', 1),
      makeSection('m2', 'Items', 'ITEMS', 2),
      makeSection('m3', 'Footer', 'FOOTER', 3),
    ],
  },
  {
    id: 'TMPL-DETAILED',
    name: 'Comprehensive',
    description: 'All sections included: specifications, qualifications, delivery schedule, SLA terms, and vendor notes.',
    layout: 'DETAILED',
    isDefault: false,
    sections: [
      makeSection('d1', 'Header', 'HEADER', 1),
      makeSection('d2', 'Details', 'DETAILS', 2),
      makeSection('d3', 'Items', 'ITEMS', 3),
      makeSection('d4', 'Terms', 'TERMS', 4),
      makeSection('d5', 'Footer', 'FOOTER', 5),
    ],
  },
];

@Component({
  selector: 'app-rfq-template-selector',
  templateUrl: './rfq-template-selector.component.html',
  styleUrls: ['./rfq-template-selector.component.scss']
})
export class RfqTemplateSelectorComponent implements OnInit {
  @Input() requestData: any = {};
  @Output() templateSelected = new EventEmitter<{ templateId: string; config: any }>();
  @Output() back = new EventEmitter<void>();

  templates: any[] = [];
  selectedTemplateId: string | null = null;
  isLoading = false;
  templateForm: FormGroup;
  procurementType: 'product' | 'service' = 'product';

  constructor(
    private fb: FormBuilder,
    private procurementService: ProcurementRequestService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {
    this.templateForm = this.fb.group({
      templateId: ['', Validators.required],
      includeHeader: [true],
      includeItems: [true],
      includeTerms: [true],
      includeFooter: [true],
      customMessage: ['']
    });
  }

  ngOnInit(): void {
    this.procurementType = this.router.url.includes('/service') ? 'service' : 'product';
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.isLoading = true;
    this.procurementService.getRFQTemplates().subscribe({
      next: (templates) => {
        this.templates = templates && templates.length > 0 ? templates : FALLBACK_TEMPLATES;
        this.resolveSelectedTemplate();
      },
      error: () => {
        this.templates = FALLBACK_TEMPLATES;
        this.resolveSelectedTemplate();
      }
    });
  }

  private resolveSelectedTemplate(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.procurementService.getRequest(parseIdToNumber(uuid)).subscribe({
        next: (req) => {
          const extReq = req as ExtendedProcurementRequest;
          if (extReq?.rfqTemplateId) {
            this.selectedTemplateId = extReq.rfqTemplateId;
            this.templateForm.patchValue({ templateId: extReq.rfqTemplateId, customMessage: extReq.rfqTitle || '' });
          } else {
            this.selectDefaultTemplate();
          }
          this.isLoading = false;
        },
        error: () => { this.selectDefaultTemplate(); this.isLoading = false; }
      });
    } else {
      this.selectDefaultTemplate();
      this.isLoading = false;
    }
  }

  private selectDefaultTemplate(): void {
    const def = this.templates.find(t => t.isDefault) || this.templates[0];
    if (def) {
      this.selectedTemplateId = def.id;
      this.templateForm.patchValue({ templateId: def.id });
    }
  }

  selectTemplate(templateId: string): void {
    this.selectedTemplateId = templateId;
    this.templateForm.patchValue({ templateId });
  }

  getSelectedTemplate(): any {
    return this.templates.find(t => t.id === this.selectedTemplateId);
  }

  onNext(): void {
    if (!this.selectedTemplateId) return;
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const typePath = this.procurementType;
    const navigate = () => this.router.navigate(['/admin/sales/commerce/requests/new', typePath, uuid, 'vendors']);

    if (uuid) {
      this.procurementService.updateRequest(parseIdToNumber(uuid), {
        rfqTemplateId: this.selectedTemplateId,
        rfqTitle: this.templateForm.get('customMessage')?.value || ''
      } as any).subscribe({
        next: navigate,
        error: (err) => {
          console.error('Failed to save template selection', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save your template selection. Please try again.' });
        }
      });
    } else {
      navigate();
    }
  }

  getLayoutKey(layout: string): string {
    const map: Record<string, string> = {
      STANDARD: 'standard', CORPORATE: 'centrifuge', MINIMAL: 'minimal', DETAILED: 'detailed',
      standard: 'standard', centrifuge: 'centrifuge', minimal: 'minimal', detailed: 'detailed'
    };
    return map[layout] ?? layout?.toLowerCase() ?? 'standard';
  }

  onBack(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const typePath = this.procurementType;
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/requests/new', typePath, uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/requests/new']);
    }
  }
}
