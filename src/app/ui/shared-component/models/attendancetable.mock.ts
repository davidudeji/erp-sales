import { AttendanceTableRecord } from "./attendancetable.model";

export const MOCK_ATTENDANCE: AttendanceTableRecord[] = [
  {
    id: '1',
    employee: 'John Okafor',
    department: 'Engineering',
    date: '2026-01-30',
    checkIn: '08:05',
    checkOut: '17:00',
    status: 'PRESENT',
    hours: 8.9
  },
  {
    id: '2',
    employee: 'Aisha Bello',
    department: 'HR',
    date: '2026-01-30',
    checkIn: '08:45',
    checkOut: '17:10',
    status: 'LATE',
    hours: 8.4
  },
  {
    id: '3',
    employee: 'Chinedu Obi',
    department: 'Finance',
    date: null,
    checkIn: null,
    checkOut: null,
    status: 'ABSENT',
    hours: 0
  },
  {
    id: '4',
    employee: 'Fatima Musa',
    department: 'Engineering',
    date: '2026-01-30',
    checkIn: '07:55',
    checkOut: '16:50',
    status: 'PRESENT',
    hours: 8.8
  },
  {
    id: '5',
    employee: 'David Johnson',
    department: 'Sales',
    date: '2026-01-30',
    checkIn: '09:10',
    checkOut: '17:05',
    status: 'LATE',
    hours: 7.9
  },
  {
    id: '6',
    employee: 'Ngozi Eze',
    department: 'Procurement',
    date: '2026-01-30',
    checkIn: '08:00',
    checkOut: '17:00',
    status: 'PRESENT',
    hours: 9
  }
];
