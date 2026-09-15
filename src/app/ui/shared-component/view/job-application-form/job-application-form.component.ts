import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-job-application-form',
  templateUrl: './job-application-form.component.html',
  styleUrl: './job-application-form.component.scss',

})
export class JobApplicationFormComponent {
  job: any; // Define a property to hold job data

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Get the job id from the route parameters
    const jobId = this.route.snapshot.paramMap.get('id');

    if (jobId) {
      // Fetch job data from localStorage
      const jobData = JSON.parse(localStorage.getItem('jobData') || '[]');
      this.job = jobData.find((job: any) => job.id === jobId);
    }
  }
}
