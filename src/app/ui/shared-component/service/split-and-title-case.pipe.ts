import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'splitAndTitleCase'
})
export class SplitAndTitleCasePipe implements PipeTransform {

  transform(value: any): any {
    if (!value) return '';
    const formatted = value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ') 
      .toLowerCase()
      .replace(/\b\w/g, (char: string) => char.toUpperCase()); 
      
    return formatted;
  }

}
