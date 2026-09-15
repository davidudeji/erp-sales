export interface QuestionDTO {
    id?: string;
    title?: string;
    questions?: QuestionItemDTO[];
    totalScore?: number;
}

export interface QuestionItemDTO {
    text: string;
    score?: number[] | null;  // Will store the selected score
}