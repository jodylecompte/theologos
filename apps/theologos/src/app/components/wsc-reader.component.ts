import { Component, inject, signal, viewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WscSelectorComponent, type QuestionSelection } from './wsc-selector.component';

interface ProofText {
  displayText: string;
  references: Array<{
    book: string;
    chapter: number;
    verse: number;
    text: string;
  }>;
}

interface WscQuestionResponse {
  number: number;
  questionText: string;
  answerText: string;
  proofTexts: ProofText[];
}

export interface ReferenceClick {
  book: string;
  chapter: number;
  verse: number;
}

export interface NavigationChange {
  questionNumber: number;
}

@Component({
  selector: 'app-wsc-reader',
  standalone: true,
  imports: [CommonModule, WscSelectorComponent],
  template: `
    <div class="wsc-reader">
      <header class="reader-header">
        <div class="header-top">
          <app-wsc-selector
            (selectionChange)="onSelectionChange($event)" />
        </div>
        <h1>Westminster Shorter Catechism</h1>
        <p class="catechism-info">Question {{ currentQuestionNumber() }} of 107</p>
      </header>

      @if (loading()) {
        <div class="loading">Loading...</div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @if (!loading() && question()) {
        <div class="question-content">
          <h2 class="question-number">Q. {{ question()!.number }}</h2>
          <p class="question-text">{{ question()!.questionText }}</p>

          <div class="answer">
            <strong>A.</strong> {{ question()!.answerText }}
          </div>

          @if (question()!.proofTexts.length > 0) {
            <div class="proof-texts">
              <h3>Scripture Proofs</h3>
              <ul class="proof-list">
                @for (proof of question()!.proofTexts; track proof.displayText) {
                  <li class="proof-item">
                    <button
                      class="proof-link"
                      (click)="onProofTextClick(proof)"
                      title="Navigate to {{ proof.displayText }}">
                      {{ proof.displayText }}
                    </button>
                    <span class="verse-preview">{{ proof.references[0].text }}</span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <nav class="question-nav">
          <button
            (click)="previousQuestion()"
            [disabled]="currentQuestionNumber() === 1"
            class="nav-button">
            ← Previous
          </button>
          <button
            (click)="nextQuestion()"
            [disabled]="currentQuestionNumber() === 107"
            class="nav-button">
            Next →
          </button>
        </nav>
      }
    </div>
  `,
  styles: [`
    .wsc-reader {
      padding: 2rem;
      font-family: Georgia, serif;
    }

    .reader-header {
      border-bottom: 2px solid #333;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
    }

    .header-top {
      margin-bottom: 1.5rem;
    }

    .reader-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
      font-weight: 600;
    }

    .catechism-info {
      margin: 0.5rem 0 0 0;
      color: #666;
      font-size: 0.9rem;
    }

    .loading, .error {
      padding: 2rem;
      text-align: center;
      font-size: 1.1rem;
    }

    .error {
      color: #c00;
    }

    .question-content {
      line-height: 1.8;
      color: #222;
    }

    .question-number {
      margin: 0 0 1rem 0;
      font-size: 1.3rem;
      color: #333;
      font-weight: 600;
    }

    .question-text {
      font-size: 1.2rem;
      margin: 0 0 1.5rem 0;
      font-style: italic;
      color: #444;
    }

    .answer {
      font-size: 1.1rem;
      margin: 0 0 2rem 0;
      padding: 1.5rem;
      background: #f8f8f8;
      border-left: 4px solid #333;
      border-radius: 4px;
    }

    .answer strong {
      color: #333;
      margin-right: 0.5rem;
    }

    .proof-texts {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #ddd;
    }

    .proof-texts h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: #666;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .proof-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .proof-item {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .proof-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .proof-link {
      display: inline-block;
      background: #333;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 0.5rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .proof-link:hover {
      background: #555;
    }

    .verse-preview {
      display: block;
      font-size: 0.95rem;
      color: #666;
      line-height: 1.6;
      font-style: italic;
    }

    .question-nav {
      display: flex;
      justify-content: space-between;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #ddd;
    }

    .nav-button {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      background: #333;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .nav-button:hover:not(:disabled) {
      background: #555;
    }

    .nav-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  `]
})
export class WscReaderComponent {
  private http = inject(HttpClient);
  private selector = viewChild(WscSelectorComponent);

  // API configuration
  private readonly apiUrl = 'http://localhost:3333/api/wsc';

  // Inputs
  @Input() initialQuestion?: number;

  // Outputs
  @Output() referenceClick = new EventEmitter<ReferenceClick>();
  @Output() navigationChange = new EventEmitter<NavigationChange>();

  // Component state
  currentQuestionNumber = signal(1);
  question = signal<WscQuestionResponse | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    // Load initial question or use input
    const initial = this.initialQuestion ?? 1;
    this.currentQuestionNumber.set(initial);
  }

  ngOnInit() {
    this.loadQuestion();
  }

  ngOnChanges() {
    if (this.initialQuestion !== undefined && this.initialQuestion !== this.currentQuestionNumber()) {
      this.currentQuestionNumber.set(this.initialQuestion);
      this.loadQuestion();
    }
  }

  onSelectionChange(selection: QuestionSelection) {
    this.currentQuestionNumber.set(selection.questionNumber);
    this.loadQuestion();
    this.navigationChange.emit({ questionNumber: selection.questionNumber });
  }

  onProofTextClick(proofText: ProofText) {
    // Navigate to the first verse in the proof text
    const firstRef = proofText.references[0];
    this.referenceClick.emit({
      book: firstRef.book,
      chapter: firstRef.chapter,
      verse: firstRef.verse,
    });
  }

  private async loadQuestion() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.apiUrl}/${this.currentQuestionNumber()}`;
      const response = await this.http.get<WscQuestionResponse>(url).toPromise();

      if (response) {
        this.question.set(response);

        // Update the selector's current question
        const selectorComponent = this.selector();
        if (selectorComponent) {
          selectorComponent.updateQuestion(this.currentQuestionNumber());
        }
      }
    } catch (err) {
      this.error.set('Failed to load question. Please try again.');
      console.error('Error loading question:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async previousQuestion() {
    if (this.currentQuestionNumber() > 1) {
      this.currentQuestionNumber.update(q => q - 1);
      await this.loadQuestion();
      this.navigationChange.emit({ questionNumber: this.currentQuestionNumber() });
    }
  }

  async nextQuestion() {
    if (this.currentQuestionNumber() < 107) {
      this.currentQuestionNumber.update(q => q + 1);
      await this.loadQuestion();
      this.navigationChange.emit({ questionNumber: this.currentQuestionNumber() });
    }
  }
}
