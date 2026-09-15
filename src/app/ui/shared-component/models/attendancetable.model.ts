export interface AttendanceTableRecord {
  id: string;
  employee: string;
  department: string;
  date: string | null;
  checkIn: string | null;
  checkOut?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'OVERTIME';
  hours?: number;
}
