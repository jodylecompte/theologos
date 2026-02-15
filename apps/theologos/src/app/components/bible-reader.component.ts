import { Component, inject, signal, viewChild, Input, Output, EventEmitter, AfterViewInit, effect, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BookSelectorComponent, type BookSelection } from './book-selector.component';

interface BibleVerse {
  number: number;
  text: string;
}

interface BibleChapterResponse {
  translation: {
    abbreviation: string;
    name: string;
  };
  book: {
    name: string;
    testament: string;
  };
  chapter: {
    number: number;
    verseCount: number;
  };
  verses: BibleVerse[];
}

interface ChapterReference {
  book: string;
  chapter: number;
}

export interface NavigationChange {
  book: string;
  chapter: number;
}

@Component({
  selector: 'app-bible-reader',
  standalone: true,
  imports: [CommonModule, BookSelectorComponent],
  template: `
    <div class="bible-reader">
      <header class="reader-header">
        <div class="header-row">
          <app-book-selector
            (selectionChange)="onSelectionChange($event)" />
          <div class="header-info">
            <h1>{{ bookName() }} {{ chapterNumber() }}</h1>
            <span class="translation-info">{{ translationName() }}</span>
          </div>
          <div class="view-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                [checked]="proseMode()"
                (change)="proseMode.set(!proseMode())"
                class="toggle-checkbox">
              <span class="toggle-text">Prose</span>
            </label>
          </div>
        </div>
      </header>

      @if (loading()) {
        <div class="loading">Loading...</div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @if (!loading() && verses().length > 0) {
        @if (proseMode()) {
          <!-- Prose mode: flowing text with inline verse numbers -->
          <div class="chapter-content prose-mode">
            @for (verse of verses(); track verse.number) {
              <span class="prose-verse" [id]="'verse-' + verse.number">
                <sup class="prose-verse-number">{{ verse.number }}</sup>{{ verse.text }}
              </span>
            }
          </div>
        } @else {
          <!-- Verse-by-verse mode: traditional format with verse numbers -->
          <div class="chapter-content">
            @for (verse of verses(); track verse.number) {
              <div class="verse" [id]="'verse-' + verse.number">
                <span class="verse-number">{{ verse.number }}</span>
                <span class="verse-text">{{ verse.text }}</span>
              </div>
            }
          </div>
        }

        <nav class="chapter-nav">
          <button
            (click)="previousChapter()"
            [disabled]="!canGoPrevious()"
            class="nav-button">
            ← Previous
          </button>
          <button
            (click)="nextChapter()"
            [disabled]="!canGoNext()"
            class="nav-button">
            Next →
          </button>
        </nav>
      }
    </div>
  `,
  styles: [`
    .bible-reader {
      padding: 1.75rem;
      font-family: var(--font-serif);
    }

    .reader-header {
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 1.45rem;
      padding-bottom: 1rem;
    }

    .header-row {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .header-info {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      flex: 1;
    }

    .view-toggle {
      display: flex;
      align-items: center;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .toggle-checkbox {
      cursor: pointer;
      width: 1rem;
      height: 1rem;
    }

    .toggle-text {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .reader-header h1 {
      margin: 0;
      font-size: 1.45rem;
      color: var(--text-strong);
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    .translation-info {
      color: var(--text-muted);
      font-size: 0.87rem;
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

    .chapter-content {
      line-height: 1.9;
      font-size: 1.08rem;
      color: #23364b;
    }

    .verse {
      margin-bottom: 0.55rem;
    }

    .verse-number {
      display: inline-block;
      width: 2.5rem;
      font-weight: bold;
      color: #6c7890;
      font-size: 0.85rem;
      vertical-align: super;
      font-family: var(--font-sans);
    }

    .verse-text {
      white-space: pre-wrap;
    }

    .verse.highlighted {
      background-color: #f8ecd6;
      transition: background-color 2s ease;
      padding: 0.25rem;
      margin: -0.25rem;
      border-radius: var(--radius-sm);
    }

    .prose-mode {
      text-align: left;
    }

    .prose-verse {
      display: inline;
    }

    .prose-verse:hover {
      background-color: rgba(0, 0, 0, 0.03);
      cursor: pointer;
    }

    .prose-verse-number {
      font-weight: bold;
      color: #6c7890;
      font-size: 0.75em;
      margin-right: 0.15em;
    }

    .chapter-nav {
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
      .bible-reader {
        padding: 1.25rem;
      }

      .header-row {
        gap: 1rem;
      }

      .reader-header h1 {
        font-size: 1.25rem;
      }
    }
  `]
})
export class BibleReaderComponent implements AfterViewInit {
  private http = inject(HttpClient);
  private selector = viewChild(BookSelectorComponent);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // API configuration
  private readonly apiUrl = 'http://localhost:3333/api/bible';
  private readonly translation = 'WEB';

  // Inputs
  @Input() initialBook?: string;
  @Input() initialChapter?: number;
  @Input() targetVerse?: number;

  // Outputs
  @Output() navigationChange = new EventEmitter<NavigationChange>();

  // Component state
  bookName = signal('Genesis');
  chapterNumber = signal(1);
  translationName = signal('World English Bible');
  verses = signal<BibleVerse[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  proseMode = signal(false);

  constructor() {
    // Set initial values from inputs or defaults
    if (this.initialBook) {
      this.bookName.set(this.initialBook);
    }
    if (this.initialChapter) {
      this.chapterNumber.set(this.initialChapter);
    }

    // Setup scroll-to-verse effect (only in browser)
    if (this.isBrowser) {
      effect(() => {
        const verse = this.targetVerse;
        if (verse && this.verses().length > 0) {
          setTimeout(() => {
            const element = document.getElementById(`verse-${verse}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('highlighted');
              setTimeout(() => element.classList.remove('highlighted'), 2000);
            }
          }, 100);
        }
      });
    }
  }

  ngAfterViewInit() {
    this.loadChapter();
  }

  ngOnChanges() {
    // Handle changes to input properties
    if (this.initialBook && this.initialBook !== this.bookName()) {
      this.bookName.set(this.initialBook);
    }
    if (this.initialChapter && this.initialChapter !== this.chapterNumber()) {
      this.chapterNumber.set(this.initialChapter);
    }
    if (this.initialBook || this.initialChapter) {
      this.loadChapter();
    }
  }

  onSelectionChange(selection: BookSelection) {
    this.bookName.set(selection.book);
    this.chapterNumber.set(selection.chapter);
    this.loadChapter();
    this.navigationChange.emit({ book: selection.book, chapter: selection.chapter });
  }

  private async loadChapter() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.apiUrl}/${this.translation}/${this.bookName()}/${this.chapterNumber()}`;
      const response = await this.http.get<BibleChapterResponse>(url).toPromise();

      if (response) {
        this.verses.set(response.verses);
        this.translationName.set(response.translation.name);

        // Update the selector's current reference
        const selectorComponent = this.selector();
        if (selectorComponent) {
          selectorComponent.updateReference(this.bookName(), this.chapterNumber());
        }
      }
    } catch (err) {
      this.error.set('Failed to load chapter. Please try again.');
      console.error('Error loading chapter:', err);
    } finally {
      this.loading.set(false);
    }
  }

  canGoPrevious(): boolean {
    return this.chapterNumber() > 1;
  }

  canGoNext(): boolean {
    // Will be limited by actual chapter count from API
    return true;
  }

  async previousChapter() {
    if (this.canGoPrevious()) {
      this.chapterNumber.update(ch => ch - 1);
      await this.loadChapter();
      this.navigationChange.emit({ book: this.bookName(), chapter: this.chapterNumber() });
    }
  }

  async nextChapter() {
    this.chapterNumber.update(ch => ch + 1);
    try {
      await this.loadChapter();
      this.navigationChange.emit({ book: this.bookName(), chapter: this.chapterNumber() });
    } catch (err) {
      // If chapter doesn't exist, go back
      this.chapterNumber.update(ch => ch - 1);
    }
  }
}
