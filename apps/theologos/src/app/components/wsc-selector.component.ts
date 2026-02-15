import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface QuestionMetadata {
  number: number;
  questionText: string;
  hasProofTexts: boolean;
}

interface QuestionsResponse {
  questions: QuestionMetadata[];
  totalQuestions: number;
}

export interface QuestionSelection {
  questionNumber: number;
}

@Component({
  selector: 'app-wsc-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selector-container">
      <button class="selector-trigger" (click)="toggleSelector()">
        <span class="current-reference">Q. {{ currentQuestion() }}</span>
        <span class="dropdown-icon">▼</span>
      </button>

      @if (isOpen()) {
        <div class="selector-modal" (click)="closeSelector()">
          <div class="selector-content" (click)="$event.stopPropagation()">
            <div class="selector-header">
              <h2>Select Question</h2>
              <button class="close-button" (click)="closeSelector()">✕</button>
            </div>

            <div class="question-selection">
              @if (loading()) {
                <div class="loading">Loading questions...</div>
              }

              @if (questions().length > 0) {
                <div class="questions-list">
                  @for (question of questions(); track question.number) {
                    <button
                      class="question-button"
                      [class.active]="question.number === currentQuestion()"
                      (click)="selectQuestion(question.number)">
                      <span class="question-number">Q. {{ question.number }}</span>
                      <span class="question-preview">{{ question.questionText }}</span>
                      @if (question.hasProofTexts) {
                        <span class="proof-indicator">📖</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .selector-container {
      position: relative;
    }

    .selector-trigger {
      padding: 0.75rem 1.25rem;
      background: white;
      border: 2px solid #333;
      border-radius: 6px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
    }

    .selector-trigger:hover {
      background: #f5f5f5;
      border-color: #555;
    }

    .current-reference {
      color: #333;
    }

    .dropdown-icon {
      color: #666;
      font-size: 0.8rem;
    }

    .selector-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .selector-content {
      background: white;
      border-radius: 12px;
      max-width: 700px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .selector-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .selector-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
    }

    .close-button {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
      padding: 0.25rem 0.5rem;
      line-height: 1;
    }

    .close-button:hover {
      color: #333;
    }

    .question-selection {
      overflow-y: auto;
      padding: 1.5rem;
      flex: 1;
    }

    .loading {
      padding: 2rem;
      text-align: center;
      color: #666;
    }

    .questions-list {
      display: grid;
      gap: 0.5rem;
    }

    .question-button {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1rem;
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .question-button:hover {
      background: #f0f0f0;
      border-color: #333;
    }

    .question-button.active {
      background: #333;
      border-color: #333;
      color: white;
    }

    .question-number {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .question-preview {
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .question-button.active .question-preview {
      color: #e0e0e0;
    }

    .proof-indicator {
      font-size: 1rem;
    }
  `]
})
export class WscSelectorComponent {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/wsc';

  // Current state
  currentQuestion = signal(1);

  // Output event
  selectionChange = output<QuestionSelection>();

  // Modal state
  isOpen = signal(false);
  loading = signal(false);
  questions = signal<QuestionMetadata[]>([]);

  constructor() {
    this.loadQuestions();
  }

  private async loadQuestions() {
    this.loading.set(true);
    try {
      const response = await this.http.get<QuestionsResponse>(this.apiUrl).toPromise();
      if (response) {
        this.questions.set(response.questions);
      }
    } catch (error) {
      console.error('Error loading WSC questions:', error);
    } finally {
      this.loading.set(false);
    }
  }

  toggleSelector() {
    this.isOpen.update(open => !open);
  }

  closeSelector() {
    this.isOpen.set(false);
  }

  selectQuestion(questionNumber: number) {
    this.currentQuestion.set(questionNumber);
    this.selectionChange.emit({ questionNumber });
    this.closeSelector();
  }

  // Public method to update current reference
  updateQuestion(questionNumber: number) {
    this.currentQuestion.set(questionNumber);
  }
}
