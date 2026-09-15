export interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  total: number;
}

export interface DepartmentHeatmap {
  department: string;
  attendance: number;
}

export interface LateArrival {
  id: string;
  name: string;
  time: string;
  department?: string;
}