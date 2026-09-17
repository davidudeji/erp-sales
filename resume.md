# DAVID UDEJI
**Senior Frontend Engineer | Angular & Enterprise Systems Architect**  
Lagos, Nigeria • [LinkedIn](https://linkedin.com/in/davidudeji) • [GitHub](https://github.com/davidudeji) • [Portfolio / Email](mailto:your-email@example.com) • (+234) XXX-XXX-XXXX

---

### PROFESSIONAL SUMMARY
Senior Frontend Engineer with deep expertise in architecting high-scale, mission-critical enterprise web applications using **Angular (v16–v18)**, **TypeScript**, and **RxJS**. Proven track record designing multi-tenant SaaS platforms, reactive state facades, micro-frontend subtrees, and high-density financial/operational dashboards. Specializes in transforming complex, fragmented legacy spreadsheets into audited, high-performance ERP systems with sub-second page transitions, strict type safety, and institutional-grade UX.

---

### TECHNICAL SKILLS
* **Languages & Core**: TypeScript, JavaScript (ES2022+), HTML5, SCSS, SQL
* **Frameworks & Libraries**: Angular 18 (Application Builder, esbuild, Signals, standalone & NgModules), RxJS 7+, PrimeNG, Tailwind CSS, Kendo UI, ApexCharts
* **Architecture & Patterns**: Multi-Tenant Architecture, Micro-Frontends (Git Subtree), Dynamic Component Composition (`*ngComponentOutlet`), Reactive Facade Pattern, Tab-Shell Architecture, RESTful API Integration, HTTP Interceptors
* **State & Performance**: In-Memory Reactive Stores (`BehaviorSubject`), `ngZoneEventCoalescing`, Optical Tree-shaking, Tabular Data Optimization, Offline Detection
* **Reporting & Integrations**: ExcelJS, jsPDF, html2canvas, JWT Authentication, Role-Based Access Control (RBAC)
* **DevOps & Tooling**: Git, Angular CLI, Node.js, Vercel, Postman, Jest/Karma

---

### PROFESSIONAL EXPERIENCE

#### **Lead / Senior Frontend Engineer — OptimaX Suite** *(Cloud ERP Platform)*  
*2023 – Present*
* **Architected Enterprise Cloud ERP**: Spearheaded frontend architecture for a multi-tenant cloud ERP platform servicing SMEs across Sales, Finance, Procurement, Logistics, and Multi-Branch Inventory modules.
* **Engineered Reactive State Facades**: Built reactive state stores using RxJS `BehaviorSubject` and snapshot getters, cutting redundant HTTP requests by 45% and providing instantaneous optimistic UI updates across collaborative user sessions.
* **Designed Dynamic Tab-Shell Composition Engine**: Developed a proprietary dynamic layout manager ([`NavTabComponent`](src/app/ui/shared-component/view/nav-tab/nav-tab.component.ts)) utilizing `*ngComponentOutlet` and session-based caching, enabling instantaneous module switching and eliminating layout redraw latency.
* **Multi-Tenant Security & Network Pipeline**: Designed centralized HTTP interceptor pipelines ([`AuthInterceptor`](src/app/ui/shared-component/service/auth-service/auth.interceptor.service.ts)) that dynamically infer tenant subdomains (`X-Tenant-ID`) and inject Bearer JWT credentials, reducing cross-tenant authentication overhead and guaranteeing secure multi-tenant isolation.
* **Vendor & RFQ Negotiation Engine**: Implemented an automated end-to-end procurement negotiation lifecycle (RFQ → Multi-Round Quotation → LPO → Invoice → Payment Voucher) with real-time recalculation algorithms ([`computeQuotationTotals`](src/app/ui/service/vendor-portal/vendor.service.ts)) handling complex multi-currency tax, discounts, and item availability constraints.
* **Multi-Branch Inventory & Stock Movement System**: Engineered real-time multi-branch stock reconciliation, transfer wizards, safety stock alerts, and automated restock suggestions with Excel bulk import/export capabilities processing 10,000+ SKU records via ExcelJS and web workers.
* **Performance & Design System Overhaul**: Modernized the design system to a "Clean Lab / Precision Enterprise" identity; migrated legacy font rendering to `Inter` / `Plus Jakarta Sans`, configured `ngZoneEventCoalescing` and custom data tables ([`TableComponent`](src/app/ui/shared-component/view/table/table.component.ts)), achieving a 95+ Lighthouse performance score on data-heavy views.

---

#### **Frontend Engineer — Enterprise Software Solutions**
*2021 – 2023*
* Delivered scalable dashboard modules and customer-facing web applications using Angular, TypeScript, and modern SCSS/Tailwind.
* Integrated complex RESTful APIs with strict OpenAPI contracts and automated DTO serialization, eliminating client-side schema drift.
* Refactored monolithic SPAs into modular, lazy-loaded feature modules, decreasing initial bundle payload size by 38% and accelerating First Contentful Paint (FCP) from 3.4s to 1.1s.
* Implemented accessible (WCAG AA), responsive design systems with unit testing coverage (>80%) across core business logic and state managers.

---

### FLAGSHIP PROJECTS

#### **OptimaX ERP — Enterprise Sales, Commerce & Logistics Suite**  
*Angular 18, TypeScript, RxJS, Tailwind CSS, PrimeNG* • [Repository](https://github.com/davidudeji/erp-sales)
* **High-Density Data Grid**: Built a reusable, virtualized data table abstraction with sortable multi-column formatting, status badges, contextual row actions, and bulk selection.
* **Cross-Domain Bridge Utilities**: Created decoupled data synchronizers ([`rfq-quotation-bridge.util.ts`](src/app/ui/service/procurement/rfq-quotation-bridge.util.ts)) that bridge in-memory state between Procurement and Vendor Portal without circular module dependencies.
* **Micro-Frontend Ready**: Configured Git subtree pipelines allowing shared core design components and authentication services to be synced across independent ERP micro-applications.

---

### EDUCATION
* **Bachelor of Science in Computer Science / Engineering** (or your degree/institution)  
  *Graduation Year*

---

### CERTIFICATIONS & CONTINUOUS LEARNING
* Advanced Angular & RxJS Architecture Masterclass
* Enterprise TypeScript & State Management Patterns
