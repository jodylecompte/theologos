import { Component, inject, signal, viewChild, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
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

interface PageResponse {
  workSlug: string;
  workTitle: string;
  pageNumber: number;
  chapterTitle?: string;
  content: string;
  proofTexts: ProofText[];
}

interface WorkMetadata {
  slug: string;
  title: string;
  author: string | null;
  type: string;
  totalUnits: number;
  totalPages: number;
}

export interface ReferenceClick {
  book: string;
  chapter: number;
  verse: number;
}

export interface NavigationChange {
  unitNumber?: number;
  pageNumber?: number;
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
            {{ getUnitLabel() }} {{ getCurrentPosition() }} of {{ getTotalCount() }}
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

      @if (!loading() && (unit() || page())) {
        <div class="unit-content">
          @if (page()) {
            <!-- Book page format -->
            <h2 class="unit-number">
              Page {{ page()!.pageNumber }}
              @if (page()!.chapterTitle) {
                <span class="chapter-context"> • {{ page()!.chapterTitle }}</span>
              }
            </h2>
            <div class="page-content">
              @for (paragraph of getPageParagraphs(); track $index) {
                <p class="page-paragraph" [class.indented]="paragraph.isIndented">{{ paragraph.text }}</p>
              }
            </div>

            @if (page()!.proofTexts.length > 0) {
              <div class="proof-texts">
                <h3>Scripture References</h3>
                <ul class="proof-list">
                  @for (proof of page()!.proofTexts; track proof.displayText) {
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
          }

          @if (unit()) {
            <!-- Catechism/Creed format -->
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
          }
        </div>

        <nav class="unit-nav">
          <button
            (click)="previousUnit()"
            [disabled]="!canGoPrevious()"
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
      padding: 1.75rem;
      font-family: var(--font-serif);
    }

    .reader-header {
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 1.45rem;
      padding-bottom: 1rem;
    }

    .header-top {
      margin-bottom: 1.5rem;
    }

    .reader-header h1 {
      margin: 0;
      font-size: 1.45rem;
      color: var(--text-strong);
      font-weight: 600;
    }

    .work-info {
      margin: 0.5rem 0 0 0;
      color: var(--text-muted);
      font-size: 0.87rem;
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
      color: #ab2f2f;
    }

    .unit-content {
      line-height: 1.85;
      color: #23364b;
    }

    .unit-number {
      margin: 0 0 1rem 0;
      font-size: 1.28rem;
      color: var(--text-strong);
      font-weight: 600;
    }

    .chapter-context {
      font-size: 0.88rem;
      color: var(--text-muted);
      font-weight: normal;
      font-style: italic;
    }

    .page-content {
      line-height: 1.8;
      max-width: 100%;
    }

    .page-paragraph {
      font-size: 1.1rem;
      margin: 0 0 1rem 0;
      line-height: 1.8;
      white-space: pre-line;
    }

    .page-paragraph.indented {
      text-indent: 2em;
    }

    .page-paragraph:last-child {
      margin-bottom: 0;
    }

    .primary-text {
      font-size: 1.1rem;
      margin: 0 0 1.5rem 0;
      white-space: normal;
      max-width: 100%;
    }

    .question-text {
      font-style: italic;
      color: #304963;
      font-size: 1.2rem;
    }

    .answer {
      font-size: 1.1rem;
      margin: 0 0 2rem 0;
      padding: 1.2rem 1.35rem;
      background: #f4f7fc;
      border-left: 4px solid var(--brand-600);
      border-radius: var(--radius-sm);
    }

    .answer strong {
      color: var(--brand-700);
      margin-right: 0.5rem;
    }

    .proof-texts {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border-subtle);
    }

    .proof-texts h3 {
      margin: 0 0 1rem 0;
      font-size: 0.95rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .proof-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .proof-item {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--surface-3);
    }

    .proof-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .proof-link {
      display: inline-block;
      background: var(--accent-100);
      color: #5e3c18;
      border: 1px solid #e8d3bc;
      padding: 0.44rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 0.5rem;
      font-family: var(--font-sans);
    }

    .proof-link:hover {
      background: #ead8c4;
      border-color: #ddc09d;
    }

    .verse-preview {
      display: block;
      font-size: 0.93rem;
      color: var(--text-muted);
      line-height: 1.6;
      font-style: italic;
    }

    .unit-nav {
      display: flex;
      justify-content: space-between;
      margin-top: 2.4rem;
      padding-top: 1.45rem;
      border-top: 1px solid var(--border-subtle);
    }

    .nav-button {
      padding: 0.66rem 1.1rem;
      font-size: 0.95rem;
      background: var(--brand-600);
      color: #f5f9ff;
      border: 1px solid var(--brand-700);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .nav-button:hover:not(:disabled) {
      background: var(--brand-700);
      transform: translateY(-1px);
    }

    .nav-button:disabled {
      background: #bac6d6;
      border-color: #bac6d6;
      cursor: not-allowed;
    }

    @media (max-width: 900px) {
      .work-reader {
        padding: 1.25rem;
      }

      .reader-header h1 {
        font-size: 1.2rem;
      }
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
  @Input() initialPage?: number;

  // Outputs
  @Output() referenceClick = new EventEmitter<ReferenceClick>();
  @Output() navigationChange = new EventEmitter<NavigationChange>();

  // Component state
  currentUnitNumber = signal(1);
  currentPageNumber = signal(1);
  unit = signal<WorkUnitResponse | null>(null);
  page = signal<PageResponse | null>(null);
  workMetadata = signal<WorkMetadata | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    // Load initial unit/page or use defaults
    if (this.initialUnit !== undefined) {
      this.currentUnitNumber.set(this.initialUnit);
    }
    if (this.initialPage !== undefined) {
      this.currentPageNumber.set(this.initialPage);
    }
  }

  ngOnInit() {
    // Load metadata first, then content will be loaded automatically
    this.loadWorkMetadata();
  }

  ngOnChanges(changes: SimpleChanges) {
    // If workSlug changed, reload everything
    if (changes['workSlug'] && !changes['workSlug'].firstChange) {
      this.workMetadata.set(null);
      this.unit.set(null);
      this.page.set(null);
      this.currentUnitNumber.set(this.initialUnit || 1);
      this.currentPageNumber.set(this.initialPage || 1);
      this.loadWorkMetadata();
      return;
    }

    if (this.initialUnit !== undefined && this.initialUnit !== this.currentUnitNumber()) {
      this.currentUnitNumber.set(this.initialUnit);
      this.loadContent();
    }
    if (this.initialPage !== undefined && this.initialPage !== this.currentPageNumber()) {
      this.currentPageNumber.set(this.initialPage);
      this.loadContent();
    }
  }

  isBook(): boolean {
    const metadata = this.workMetadata();
    return metadata ? metadata.type === 'book' : false;
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
          totalPages: response.totalPages || 0,
        });
        // Load content after metadata is available
        await this.loadContent();
      }
    } catch (err) {
      console.error('Error loading work metadata:', err);
    }
  }

  private async loadContent() {
    if (this.isBook()) {
      await this.loadPage();
    } else {
      await this.loadUnit();
    }
  }

  onSelectionChange(selection: UnitSelection) {
    if (this.isBook()) {
      // For books, selection might be chapter-based, default to first page
      this.currentPageNumber.set(selection.unitNumber);
      this.loadPage();
      this.navigationChange.emit({ pageNumber: selection.unitNumber });
    } else {
      this.currentUnitNumber.set(selection.unitNumber);
      this.loadUnit();
      this.navigationChange.emit({ unitNumber: selection.unitNumber });
    }
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

  private async loadPage() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.apiUrl}/${this.workSlug}/pages/${this.currentPageNumber()}`;
      const response = await this.http.get<PageResponse>(url).toPromise();

      if (response) {
        this.page.set(response);
        this.unit.set(null); // Clear unit data

        // Update the selector's current position
        const selectorComponent = this.selector();
        if (selectorComponent) {
          selectorComponent.updateUnit(this.currentPageNumber());
        }
      }
    } catch (err) {
      this.error.set('Failed to load page. Please try again.');
      console.error('Error loading page:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUnit() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.apiUrl}/${this.workSlug}/units/${this.currentUnitNumber()}`;
      const response = await this.http.get<WorkUnitResponse>(url).toPromise();

      if (response) {
        this.unit.set(response);
        this.page.set(null); // Clear page data

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
    if (this.isBook()) return 'Page';
    const type = this.workMetadata()?.type;
    if (type === 'catechism') return 'Q.';
    if (type === 'confession') return 'Article';
    if (type === 'creed') return 'Section';
    return 'Unit';
  }

  getPageParagraphs(): Array<{ text: string; isIndented: boolean }> {
    const content = this.page()?.content || '';
    if (!content) return [];

    const lines = content.split('\n');
    const paragraphs: Array<{ text: string; isIndented: boolean }> = [];
    let currentPara: string[] = [];
    let currentIsIndented = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Empty line = paragraph break
      if (!trimmedLine) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n'),
            isIndented: currentIsIndented
          });
          currentPara = [];
        }
        continue;
      }

      // Check if line starts with paragraph marker
      const isIndented = trimmedLine.startsWith('¶');
      const cleanLine = isIndented ? trimmedLine.substring(1) : trimmedLine;

      // If we hit an indented line and have content, end current paragraph
      if (isIndented && currentPara.length > 0) {
        paragraphs.push({
          text: currentPara.join('\n'),
          isIndented: currentIsIndented
        });
        currentPara = [];
      }

      // Start new paragraph or continue current
      if (currentPara.length === 0) {
        currentIsIndented = isIndented;
      }

      currentPara.push(cleanLine);
    }

    // Add final paragraph
    if (currentPara.length > 0) {
      paragraphs.push({
        text: currentPara.join('\n'),
        isIndented: currentIsIndented
      });
    }

    return paragraphs;
  }

  getCurrentPosition(): number {
    return this.isBook() ? this.currentPageNumber() : this.currentUnitNumber();
  }

  getTotalCount(): number {
    const metadata = this.workMetadata();
    if (!metadata) return 0;
    return this.isBook() ? metadata.totalPages : metadata.totalUnits;
  }

  canGoNext(): boolean {
    return this.getCurrentPosition() < this.getTotalCount();
  }

  canGoPrevious(): boolean {
    return this.getCurrentPosition() > 1;
  }

  async previousUnit() {
    if (!this.canGoPrevious()) return;

    if (this.isBook()) {
      this.currentPageNumber.update(p => p - 1);
      await this.loadPage();
      this.navigationChange.emit({ pageNumber: this.currentPageNumber() });
    } else {
      this.currentUnitNumber.update(q => q - 1);
      await this.loadUnit();
      this.navigationChange.emit({ unitNumber: this.currentUnitNumber() });
    }
  }

  async nextUnit() {
    if (!this.canGoNext()) return;

    if (this.isBook()) {
      this.currentPageNumber.update(p => p + 1);
      await this.loadPage();
      this.navigationChange.emit({ pageNumber: this.currentPageNumber() });
    } else {
      this.currentUnitNumber.update(q => q + 1);
      await this.loadUnit();
      this.navigationChange.emit({ unitNumber: this.currentUnitNumber() });
    }
  }
}
