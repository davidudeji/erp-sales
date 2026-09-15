import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[appTableBody]'
})
export class TableBodyDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}
