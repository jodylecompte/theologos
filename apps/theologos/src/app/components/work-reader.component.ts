import { Component, inject, signal, viewChild, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WorkUnitSelectorComponent, type UnitSelection } from './work-unit-selector.component';

interface ProofText {
  displayText: string;
  references: Array<{
    book: string;
    chapter: number;
    verse: number;
    text: string;
  }>;
}

interface WorkUnitResponse {
  workSlug: string;
  workTitle: string;
  number: number;
  primaryText: string;
  secondaryText: string;
  proofTexts: ProofText[];
}

interface WorkMetadata {
  slug: string;
  title: string;
  author: string | null;
  type: string;
  totalUnits: number;
}

export interface ReferenceClick {
  book: string;
  chapter: number;
  verse: number;
}

export interface NavigationChange {
  unitNumber: number;
}

@Component({
  selector: 'app-work-reader',
  standalone: true,
  imports: [CommonModule, WorkUnitSelectorComponent],
  template: `
    <div class="work-reader">
      <header class="reader-header">
        <div class="header-top">
          <app-work-unit-selector
            [workSlug]="workSlug"
            (selectionChange)="onSelectionChange($event)" />
        </div>
        <h1>{{ workMetadata()?.title || 'Loading...' }}</h1>
        @if (workMetadata()) {
          <p class="work-info">
            {{ getUnitLabel() }} {{ currentUnitNumber() }} of {{ workMetadata()!.totalUnits }}
            @if (workMetadata()!.author) {
              <span class="author"> • {{ workMetadata()!.author }}</span>
            }
          </p>
        }
      </header>

      @if (loading()) {
        <div class="loading">Loading...</div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @if (!loading() && unit()) {
        <div class="unit-content">
          <h2 class="unit-number">{{ getUnitLabel() }} {{ unit()!.number }}</h2>

          @if (unit()!.secondaryText) {
            <!-- Catechism format: Question and Answer -->
            <p class="primary-text question-text">{{ unit()!.primaryText }}</p>
            <div class="answer">
              <strong>A.</strong> {{ unit()!.secondaryText }}
            </div>
          } @else {
            <!-- Creed/Confession format: Just content -->
            <div class="primary-text">{{ unit()!.primaryText }}</div>
          }

          @if (unit()!.proofTexts.length > 0) {
            <div class="proof-texts">
              <h3>Scripture References</h3>
              <ul class="proof-list">
                @for (proof of unit()!.proofTexts; track proof.displayText) {
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

        <nav class="unit-nav">
          <button
            (click)="previousUnit()"
            [disabled]="currentUnitNumber() === 1"
            class="nav-button">
            ← Previous
          </button>
          <button
            (click)="nextUnit()"
            [disabled]="!canGoNext()"
            class="nav-button">
            Next →
          </button>
        </nav>
      }
    </div>
  `,
  styles: [`
    .work-reader {
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

    .work-info {
      margin: 0.5rem 0 0 0;
      color: #666;
      font-size: 0.9rem;
    }

    .author {
      font-style: italic;
    }

    .loading, .error {
      padding: 2rem;
      text-align: center;
      font-size: 1.1rem;
    }

    .error {
      color: #c00;
    }

    .unit-content {
      line-height: 1.8;
      color: #222;
    }

    .unit-number {
      margin: 0 0 1rem 0;
      font-size: 1.3rem;
      color: #333;
      font-weight: 600;
    }

    .primary-text {
      font-size: 1.1rem;
      margin: 0 0 1.5rem 0;
      white-space: pre-wrap;
    }

    .question-text {
      font-style: italic;
      color: #444;
      font-size: 1.2rem;
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

    .unit-nav {
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
export class WorkReaderComponent implements OnInit, OnChanges {
  private http = inject(HttpClient);
  private selector = viewChild(WorkUnitSelectorComponent);

  // API configuration
  private readonly apiUrl = 'http://localhost:3333/api/works';

  // Inputs
  @Input() workSlug: string = 'wsc'; // Default to Westminster Shorter Catechism
  @Input() initialUnit?: number;

  // Outputs
  @Output() referenceClick = new EventEmitter<ReferenceClick>();
  @Output() navigationChange = new EventEmitter<NavigationChange>();

  // Component state
  currentUnitNumber = signal(1);
  unit = signal<WorkUnitResponse | null>(null);
  workMetadata = signal<WorkMetadata | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    // Load initial unit or use input
    const initial = this.initialUnit ?? 1;
    this.currentUnitNumber.set(initial);
  }

  ngOnInit() {
    this.loadWorkMetadata();
    this.loadUnit();
  }

  ngOnChanges() {
    if (this.initialUnit !== undefined && this.initialUnit !== this.currentUnitNumber()) {
      this.currentUnitNumber.set(this.initialUnit);
      this.loadUnit();
    }
  }

  private async loadWorkMetadata() {
    try {
      const url = `${this.apiUrl}/${this.workSlug}`;
      const response = await this.http.get<any>(url).toPromise();
      if (response) {
        this.workMetadata.set({
          slug: response.slug,
          title: response.title,
          author: response.author,
          type: response.type,
          totalUnits: response.totalUnits,
        });
      }
    } catch (err) {
      console.error('Error loading work metadata:', err);
    }
  }

  onSelectionChange(selection: UnitSelection) {
    this.currentUnitNumber.set(selection.unitNumber);
    this.loadUnit();
    this.navigationChange.emit({ unitNumber: selection.unitNumber });
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

  private async loadUnit() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.apiUrl}/${this.workSlug}/units/${this.currentUnitNumber()}`;
      const response = await this.http.get<WorkUnitResponse>(url).toPromise();

      if (response) {
        this.unit.set(response);

        // Update the selector's current unit
        const selectorComponent = this.selector();
        if (selectorComponent) {
          selectorComponent.updateUnit(this.currentUnitNumber());
        }
      }
    } catch (err) {
      this.error.set('Failed to load content. Please try again.');
      console.error('Error loading unit:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getUnitLabel(): string {
    const type = this.workMetadata()?.type;
    if (type === 'catechism') return 'Q.';
    if (type === 'confession') return 'Article';
    if (type === 'creed') return 'Section';
    return 'Unit';
  }

  canGoNext(): boolean {
    const metadata = this.workMetadata();
    if (!metadata) return false;
    return this.currentUnitNumber() < metadata.totalUnits;
  }

  async previousUnit() {
    if (this.currentUnitNumber() > 1) {
      this.currentUnitNumber.update(q => q - 1);
      await this.loadUnit();
      this.navigationChange.emit({ unitNumber: this.currentUnitNumber() });
    }
  }

  async nextUnit() {
    if (this.canGoNext()) {
      this.currentUnitNumber.update(q => q + 1);
      await this.loadUnit();
      this.navigationChange.emit({ unitNumber: this.currentUnitNumber() });
    }
  }
}
