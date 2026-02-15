import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Book {
  name: string;
  abbreviation: string;
  testament: string;
  canonicalOrder: number;
  chapterCount: number;
  chapters: number[];
}

interface BooksResponse {
  books: Book[];
  totalBooks: number;
}

export interface BookSelection {
  book: string;
  chapter: number;
}

@Component({
  selector: 'app-book-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selector-container">
      <button class="selector-trigger" (click)="toggleSelector()">
        <span class="current-reference">{{ currentBook() }} {{ currentChapter() }}</span>
        <span class="dropdown-icon">▼</span>
      </button>

      @if (isOpen()) {
        <div class="selector-modal" (click)="closeSelector()">
          <div class="selector-content" (click)="$event.stopPropagation()">
            <div class="selector-header">
              <h2>Select Chapter</h2>
              <button class="close-button" (click)="closeSelector()">✕</button>
            </div>

            @if (selectedBook()) {
              <!-- Chapter selection view -->
              <div class="chapter-selection">
                <button class="back-button" (click)="backToBooks()">
                  ← Back to Books
                </button>
                <h3 class="book-title">{{ selectedBook()?.name }}</h3>
                <div class="chapters-grid">
                  @for (chapter of selectedBook()?.chapters; track chapter) {
                    <button
                      class="chapter-button"
                      [class.active]="chapter === currentChapter()"
                      (click)="selectChapter(chapter)">
                      {{ chapter }}
                    </button>
                  }
                </div>
              </div>
            } @else {
              <!-- Book selection view -->
              <div class="book-selection">
                @if (loading()) {
                  <div class="loading">Loading books...</div>
                }

                @if (oldTestamentBooks().length > 0) {
                  <div class="testament-section">
                    <h3 class="testament-title">Old Testament</h3>
                    <div class="books-list">
                      @for (book of oldTestamentBooks(); track book.name) {
                        <button
                          class="book-button"
                          [class.active]="book.name === currentBook()"
                          (click)="selectBook(book)">
                          <span class="book-name">{{ book.name }}</span>
                          <span class="chapter-count">{{ book.chapterCount }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }

                @if (newTestamentBooks().length > 0) {
                  <div class="testament-section">
                    <h3 class="testament-title">New Testament</h3>
                    <div class="books-list">
                      @for (book of newTestamentBooks(); track book.name) {
                        <button
                          class="book-button"
                          [class.active]="book.name === currentBook()"
                          (click)="selectBook(book)">
                          <span class="book-name">{{ book.name }}</span>
                          <span class="chapter-count">{{ book.chapterCount }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
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
      padding: 0.62rem 0.95rem;
      background: #f8fafd;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.98rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
    }

    .selector-trigger:hover {
      background: #ffffff;
      border-color: var(--brand-500);
      box-shadow: 0 8px 16px rgba(17, 58, 102, 0.1);
    }

    .current-reference {
      color: var(--text-strong);
    }

    .dropdown-icon {
      color: var(--text-muted);
      font-size: 0.72rem;
    }

    .selector-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(8, 18, 33, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .selector-content {
      background: white;
      border-radius: var(--radius-lg);
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-2);
    }

    .selector-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(180deg, #f9fbff 0%, #f3f6fb 100%);
    }

    .selector-header h2 {
      margin: 0;
      font-family: var(--font-serif);
      font-size: 1.32rem;
      color: var(--text-strong);
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
      color: var(--text-strong);
    }

    .book-selection, .chapter-selection {
      overflow-y: auto;
      padding: 1.5rem;
      flex: 1;
    }

    .loading {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
    }

    .testament-section {
      margin-bottom: 2rem;
    }

    .testament-title {
      margin: 0 0 1rem 0;
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.09em;
    }

    .books-list {
      display: grid;
      gap: 0.5rem;
    }

    .book-button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .book-button:hover {
      background: #ffffff;
      border-color: var(--brand-500);
    }

    .book-button.active {
      background: var(--brand-600);
      border-color: var(--brand-700);
      color: white;
    }

    .book-name {
      font-weight: 500;
      font-size: 1rem;
    }

    .chapter-count {
      font-size: 0.875rem;
      color: var(--text-muted);
      font-weight: 400;
    }

    .book-button.active .chapter-count {
      color: #ccc;
    }

    .back-button {
      padding: 0.5rem 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .back-button:hover {
      background: #ffffff;
    }

    .book-title {
      margin: 0 0 1.5rem 0;
      font-family: var(--font-serif);
      font-size: 1.35rem;
      color: var(--text-strong);
    }

    .chapters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
      gap: 0.5rem;
    }

    .chapter-button {
      padding: 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .chapter-button:hover {
      background: #ffffff;
      border-color: var(--brand-500);
    }

    .chapter-button.active {
      background: var(--brand-600);
      border-color: var(--brand-700);
      color: white;
    }
  `]
})
export class BookSelectorComponent {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/books';

  // Inputs
  currentBook = signal('Genesis');
  currentChapter = signal(1);

  // Output event
  selectionChange = output<BookSelection>();

  // State
  isOpen = signal(false);
  loading = signal(false);
  books = signal<Book[]>([]);
  selectedBook = signal<Book | null>(null);

  // Computed
  oldTestamentBooks = signal<Book[]>([]);
  newTestamentBooks = signal<Book[]>([]);

  constructor() {
    this.loadBooks();
  }

  private async loadBooks() {
    this.loading.set(true);
    try {
      const response = await this.http.get<BooksResponse>(this.apiUrl).toPromise();
      if (response) {
        this.books.set(response.books);
        this.oldTestamentBooks.set(response.books.filter(b => b.testament === 'OT'));
        this.newTestamentBooks.set(response.books.filter(b => b.testament === 'NT'));
      }
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      this.loading.set(false);
    }
  }

  toggleSelector() {
    this.isOpen.update(open => !open);
    if (!this.isOpen()) {
      this.selectedBook.set(null);
    }
  }

  closeSelector() {
    this.isOpen.set(false);
    this.selectedBook.set(null);
  }

  selectBook(book: Book) {
    this.selectedBook.set(book);
  }

  backToBooks() {
    this.selectedBook.set(null);
  }

  selectChapter(chapter: number) {
    const book = this.selectedBook();
    if (book) {
      this.currentBook.set(book.name);
      this.currentChapter.set(chapter);
      this.selectionChange.emit({ book: book.name, chapter });
      this.closeSelector();
    }
  }

  // Public method to update current reference
  updateReference(book: string, chapter: number) {
    this.currentBook.set(book);
    this.currentChapter.set(chapter);
  }
}
