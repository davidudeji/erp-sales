export interface AppraisalQuestionsDTO {
  id?: string;
  title?: string;
  department: string;
  level: string;
  sections: string;
  questions?: AppraisalQuestionItemsDTO[];
  totalScore?: number;
}

export interface AppraisalQuestionItemsDTO {
  text: string;
  score?: number[] | null; // Will store the selected score
}
