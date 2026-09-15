import { Component } from '@angular/core';

@Component({
  selector: 'app-question-answer',
  templateUrl: './question-answer.component.html',
  styleUrls: ['./question-answer.component.scss']
})
export class QuestionAnswerComponent {
  profiles = [
    { img: 'assets/profile.jpg', name: 'Aribisala Abiola', position: 'QA Lead' },
  ];
}
