import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  previewImage?: string;
  sections: {
    showCustomerDetails: boolean;
    showCompanyLogo: boolean;
    showTaxBreakdown: boolean;
    showShippingDetails: boolean;
    showPaymentTerms: boolean;
    showNotes: boolean;
    showTermsConditions: boolean;
    showSignature: boolean;
    showAttachments: boolean;
    showItemImages: boolean;
    showSKU: boolean;
    showSerialNumbers: boolean;
    showBatchDetails: boolean;
    showSubtotalPerGroup: boolean;
    showTotalInWords: boolean;
    showCurrencySymbol: boolean;
    showVendorInfo: boolean;
    showCustomFields: boolean;
  };
  layout: 'standard' | 'compact' | 'detailed' | 'minimal' | 'emirates' | 'thcomms' | 'emirates-custbank';
  fontSize: 'small' | 'medium' | 'large';
  colorTheme: 'professional' | 'modern' | 'classic' | 'minimal' | 'emirates' | 'thcomms' | 'emirates-custbank';
}

@Component({
  selector: 'app-template-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-types.component.html',
  styleUrls: ['./template-types.component.scss']
})
export class TemplateTypesComponent implements OnInit {
  @Input() quoteData: any; // Quote form data
  @Input() selectedTemplateId: string = '';
  @Input() documentType: 'quote' | 'invoice' = 'quote';

  get docLabel(): string {
    return this.documentType === 'invoice' ? 'Invoice' : 'Quotation';
  }
  @Output() templateSelected = new EventEmitter<QuoteTemplate>();
  @Output() createAction = new EventEmitter<{ action: 'pdf' | 'email' | 'both' }>();
  @Output() back = new EventEmitter<void>();

  templates: QuoteTemplate[] = [
    {
      id: 'standard',
      name: 'Standard Professional',
      description: 'Clean, balanced layout with all essential business information',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: true,
        showTaxBreakdown: true,
        showShippingDetails: true,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: true,
        showAttachments: false,
        showItemImages: false,
        showSKU: true,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: true,
        showTotalInWords: true,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: false
      },
      layout: 'standard',
      fontSize: 'medium',
      colorTheme: 'professional'
    },
    {
      id: 'minimal',
      name: 'Minimal Clean',
      description: 'Stripped-down design focusing only on core quote details',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: false,
        showTaxBreakdown: false,
        showShippingDetails: false,
        showPaymentTerms: false,
        showNotes: false,
        showTermsConditions: false,
        showSignature: false,
        showAttachments: false,
        showItemImages: false,
        showSKU: false,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: false,
        showTotalInWords: false,
        showCurrencySymbol: true,
        showVendorInfo: false,
        showCustomFields: false
      },
      layout: 'minimal',
      fontSize: 'small',
      colorTheme: 'minimal'
    },
    {
      id: 'detailed',
      name: 'Detailed Comprehensive',
      description: 'Full-featured template with all sections for complex quotes',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: true,
        showTaxBreakdown: true,
        showShippingDetails: true,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: true,
        showAttachments: true,
        showItemImages: true,
        showSKU: true,
        showSerialNumbers: true,
        showBatchDetails: true,
        showSubtotalPerGroup: true,
        showTotalInWords: true,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: true
      },
      layout: 'detailed',
      fontSize: 'medium',
      colorTheme: 'modern'
    },
    {
      id: 'compact',
      name: 'Compact Economy',
      description: 'Space-saving design optimized for printing and quick reviews',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: false,
        showTaxBreakdown: true,
        showShippingDetails: false,
        showPaymentTerms: true,
        showNotes: false,
        showTermsConditions: false,
        showSignature: false,
        showAttachments: false,
        showItemImages: false,
        showSKU: true,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: false,
        showTotalInWords: false,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: false
      },
      layout: 'compact',
      fontSize: 'small',
      colorTheme: 'classic'
    },
    {
      id: 'custom-client',
      name: 'Client-Facing Premium',
      description: 'Branded template with prominent customer details and visual appeal',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: true,
        showTaxBreakdown: true,
        showShippingDetails: true,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: true,
        showAttachments: true,
        showItemImages: true,
        showSKU: true,
        showSerialNumbers: true,
        showBatchDetails: true,
        showSubtotalPerGroup: true,
        showTotalInWords: true,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: true
      },
      layout: 'detailed',
      fontSize: 'large',
      colorTheme: 'modern'
    },
    {
      id: 'emirates',
      name: 'Emirates Corporate',
      description: 'Elegant layout styled after Emirates Airlines invoices, featuring dual signature sections and structured project metadata',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: true,
        showTaxBreakdown: true,
        showShippingDetails: false,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: true,
        showAttachments: false,
        showItemImages: false,
        showSKU: false,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: false,
        showTotalInWords: true,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: false
      },
      layout: 'emirates',
      fontSize: 'medium',
      colorTheme: 'emirates'
    },
    {
      id: 'emirates-custbank',
      name: 'Emirates with Customer Bank',
      description: 'Elegant Emirates Corporate layout including client bank account details in the invoice information',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: true,
        showTaxBreakdown: true,
        showShippingDetails: false,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: true,
        showAttachments: false,
        showItemImages: false,
        showSKU: false,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: false,
        showTotalInWords: true,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: false
      },
      layout: 'emirates-custbank',
      fontSize: 'medium',
      colorTheme: 'emirates-custbank'
    },
    {
      id: 'thcomms',
      name: '13th Comms Modern',
      description: 'Clean modern template based on 13th Communications Ltd invoices with custom right-aligned header and clean billing metadata',
      sections: {
        showCustomerDetails: true,
        showCompanyLogo: false,
        showTaxBreakdown: true,
        showShippingDetails: false,
        showPaymentTerms: true,
        showNotes: true,
        showTermsConditions: true,
        showSignature: false,
        showAttachments: false,
        showItemImages: false,
        showSKU: false,
        showSerialNumbers: false,
        showBatchDetails: false,
        showSubtotalPerGroup: false,
        showTotalInWords: false,
        showCurrencySymbol: true,
        showVendorInfo: true,
        showCustomFields: false
      },
      layout: 'thcomms',
      fontSize: 'medium',
      colorTheme: 'thcomms'
    }
  ];

  selectedTemplate: QuoteTemplate | null = null;
  selectedAction: 'pdf' | 'email' | 'both' = 'pdf';
  showActionSelection: boolean = false;

  // Customer-specific template preferences (simulated - would come from API)
  customerTemplatePreferences: { [customerId: string]: string } = {
    'CUST-001': 'standard', // Mama Nkechi likes standard
    'CUST-002': 'detailed', // Tech Solutions wants detailed
    'CUST-003': 'minimal', // Global Services likes minimal
    'CUST-004': 'compact', // Dangote wants compact
    'CUST-005': 'standard' // Obinna uses standard
  };

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    // Auto-select template based on customer preference if available
    if (this.quoteData?.customerId) {
      const preferredId = this.customerTemplatePreferences[this.quoteData.customerId];
      if (preferredId) {
        this.selectedTemplateId = preferredId;
        this.selectedTemplate = this.templates.find(t => t.id === preferredId) || null;
      }
    }

    // If no template selected, use first one
    if (!this.selectedTemplate && this.templates.length > 0) {
      this.selectedTemplate = this.templates[0];
      this.selectedTemplateId = this.selectedTemplate.id;
    }
  }

  selectTemplate(templateId: string): void {
    this.selectedTemplateId = templateId;
    this.selectedTemplate = this.templates.find(t => t.id === templateId) || null;
    this.templateSelected.emit(this.selectedTemplate || undefined);
  }

  getTemplatePreview(template: QuoteTemplate): string {
    // In a real implementation, this would return a preview image URL
    // For now, we'll return a placeholder based on template ID
    const previewMap: { [key: string]: string } = {
      'standard': '📄 Standard Template',
      'minimal': '📝 Minimal Template',
      'detailed': '📊 Detailed Template',
      'compact': '📋 Compact Template',
      'custom-client': '⭐ Premium Template',
      'emirates': '✈️ Emirates Airlines Template',
      'emirates-custbank': '✈️ Emirates (with Client Bank)',
      'thcomms': '📡 13th Comms Template'
    };
    return previewMap[template.id] || '📄 Template Preview';
  }

  getSectionStatus(section: string): string {
    if (!this.selectedTemplate) return 'hidden';
    const sections = this.selectedTemplate.sections as any;
    return sections[section] ? 'visible' : 'hidden';
  }

  proceedToAction(): void {
    if (!this.selectedTemplate) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a template first' });
      return;
    }
    this.showActionSelection = true;
  }

  confirmCreate(action: 'pdf' | 'email' | 'both'): void {
    this.createAction.emit({ action });
  }

  goBack(): void {
    if (this.showActionSelection) {
      this.showActionSelection = false;
    } else {
      this.back.emit();
    }
  }

  getTemplateIcon(templateId: string): string {
    const icons: { [key: string]: string } = {
      'standard': 'fa-file-alt',
      'minimal': 'fa-file',
      'detailed': 'fa-file-pdf',
      'compact': 'fa-file-contract',
      'custom-client': 'fa-file-invoice',
      'emirates': 'fa-plane',
      'emirates-custbank': 'fa-plane-departure',
      'thcomms': 'fa-broadcast-tower'
    };
    return icons[templateId] || 'fa-file';
  }

  getTemplateColor(templateId: string): string {
    const colors: { [key: string]: string } = {
      'standard': '#1a2d4a',
      'minimal': '#4a5a6e',
      'detailed': '#2a4a6a',
      'compact': '#3a6a8a',
      'custom-client': '#2EB270',
      'emirates': '#A32638',
      'emirates-custbank': '#A32638',
      'thcomms': '#1B365D'
    };
    return colors[templateId] || '#1a2d4a';
  }

  // Keyed by template.id (not template.layout) — 'detailed' and 'custom-client'
  // share the same `layout` value but must render as two distinct mockups,
  // matching their two distinct bespoke real preview layouts in the form.
  getLayoutKey(templateId: string): string {
    const map: Record<string, string> = {
      standard: 'standard',
      minimal: 'minimal',
      detailed: 'detailed',
      compact: 'compact',
      'custom-client': 'custom-client',
      emirates: 'centrifuge',
      'emirates-custbank': 'centrifuge',
      thcomms: 'standard'
    };
    return map[templateId] ?? 'standard';
  }

  isTemplateDefault(template: QuoteTemplate): boolean {
    return template.id === 'standard';
  }

  // Derives a short list of feature tags from the template's visible sections,
  // matching the tag-pill style used by the RFQ template selector.
  getTemplateTags(template: QuoteTemplate): string[] {
    const sections = template.sections;
    const labels: [keyof QuoteTemplate['sections'], string][] = [
      ['showCustomerDetails', 'Customer Details'],
      ['showCompanyLogo', 'Logo'],
      ['showTaxBreakdown', 'Tax Breakdown'],
      ['showPaymentTerms', 'Payment Terms'],
      ['showNotes', 'Notes'],
      ['showTermsConditions', 'Terms'],
      ['showSignature', 'Signature'],
      ['showItemImages', 'Item Images'],
      ['showSKU', 'SKU']
    ];
    return labels.filter(([key]) => sections[key]).map(([, label]) => label).slice(0, 4);
  }
}