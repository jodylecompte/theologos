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
        </div>
      </header>

      @if (loading()) {
        <div class="loading">Loading...</div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @if (!loading() && verses().length > 0) {
        <div class="chapter-content">
          @for (verse of verses(); track verse.number) {
            <div class="verse" [id]="'verse-' + verse.number">
              <span class="verse-number">{{ verse.number }}</span>
              <span class="verse-text">{{ verse.text }}</span>
            </div>
          }
        </div>

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
      padding: 2rem;
      font-family: Georgia, serif;
    }

    .reader-header {
      border-bottom: 2px solid #333;
      margin-bottom: 2rem;
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

    .reader-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
      font-weight: 600;
    }

    .translation-info {
      color: #666;
      font-size: 0.9rem;
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

    .chapter-content {
      line-height: 1.8;
      font-size: 1.1rem;
      color: #222;
    }

    .verse {
      margin-bottom: 0.5rem;
    }

    .verse-number {
      display: inline-block;
      width: 2.5rem;
      font-weight: bold;
      color: #666;
      font-size: 0.85rem;
      vertical-align: super;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .verse-text {
      white-space: pre-wrap;
    }

    .verse.highlighted {
      background-color: #ffeb3b;
      transition: background-color 2s ease;
      padding: 0.25rem;
      margin: -0.25rem;
      border-radius: 3px;
    }

    .chapter-nav {
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
