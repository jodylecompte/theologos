import { Component, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-bible-reader',
  standalone: true,
  imports: [CommonModule, BookSelectorComponent],
  template: `
    <div class="bible-reader">
      <header class="reader-header">
        <div class="header-top">
          <app-book-selector
            (selectionChange)="onSelectionChange($event)" />
        </div>
        <h1>{{ bookName() }} {{ chapterNumber() }}</h1>
        <p class="translation-info">{{ translationName() }}</p>
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
            <div class="verse">
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
      max-width: 800px;
      margin: 0 auto;
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
      font-size: 2rem;
      color: #333;
    }

    .translation-info {
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
export class BibleReaderComponent {
  private http = inject(HttpClient);
  private selector = viewChild(BookSelectorComponent);

  // API configuration
  private readonly apiUrl = 'http://localhost:3333/api/bible';
  private readonly translation = 'WEB';

  // Component state
  bookName = signal('Genesis');
  chapterNumber = signal(1);
  translationName = signal('World English Bible');
  verses = signal<BibleVerse[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.loadChapter();
  }

  onSelectionChange(selection: BookSelection) {
    this.bookName.set(selection.book);
    this.chapterNumber.set(selection.chapter);
    this.loadChapter();
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
    }
  }

  async nextChapter() {
    this.chapterNumber.update(ch => ch + 1);
    try {
      await this.loadChapter();
    } catch (err) {
      // If chapter doesn't exist, go back
      this.chapterNumber.update(ch => ch - 1);
    }
  }
}
