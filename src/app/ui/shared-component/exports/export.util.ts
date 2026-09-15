import { AttendanceTableRecord } from "../models/attendancetable.model";

export function exportCSV(data: AttendanceTableRecord[], columns: string[]) {
  const header = columns.join(',');
  const rows = data.map(row =>
    columns.map(col => `"${(row as any)[col] ?? ''}"`).join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'attendance-report.csv';
  link.click();
}
