
  export function downloadCsv(filename: string, rows: string[][]): void {
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    //link.href = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);

  }