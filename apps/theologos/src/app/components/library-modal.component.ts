import { Component, inject, signal, output, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface WorkItem {
  id: string;
  title: string;
  author: string | null;
  type: string;
  tradition: string | null;
  slug: string;
}

interface LibraryResponse {
  works: WorkItem[];
  totalCount: number;
}

export interface WorkSelection {
  slug: string;
  title: string;
  type: string;
}

@Component({
  selector: 'app-library-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="library-modal" (click)="close()">
      <div class="library-content" (click)="$event.stopPropagation()">
        <div class="library-header">
          <h2>📚 Library</h2>
          <button class="close-button" (click)="close()">✕</button>
        </div>

        <div class="library-filters">
          <div class="filter-group">
            <label>Search</label>
            <input
              type="text"
              class="filter-input"
              placeholder="Search by title or author..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)" />
          </div>

          <div class="filter-group">
            <label>Type</label>
            <select class="filter-select" [ngModel]="selectedType()" (ngModelChange)="selectedType.set($event)">
              <option value="">All Types</option>
              <option value="book">Books</option>
              <option value="catechism">Catechisms</option>
              <option value="confession">Confessions</option>
              <option value="creed">Creeds</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Tradition</label>
            <select class="filter-select" [ngModel]="selectedTradition()" (ngModelChange)="selectedTradition.set($event)">
              <option value="">All Traditions</option>
              @for (tradition of availableTraditions(); track tradition) {
                <option [value]="tradition">{{ tradition }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Author</label>
            <select class="filter-select" [ngModel]="selectedAuthor()" (ngModelChange)="selectedAuthor.set($event)">
              <option value="">All Authors</option>
              @for (author of availableAuthors(); track author) {
                <option [value]="author">{{ author }}</option>
              }
            </select>
          </div>
        </div>

        <div class="library-body">
          @if (loading()) {
            <div class="loading">Loading library...</div>
          }

          @if (error()) {
            <div class="error">{{ error() }}</div>
          }

          @if (!loading() && !error()) {
            <div class="works-grid">
              @for (work of filteredWorks(); track work.id) {
                <div class="work-card" (click)="selectWork(work)">
                  <div class="work-type-badge" [attr.data-type]="work.type">
                    {{ getTypeLabel(work.type) }}
                  </div>
                  <h3 class="work-title">{{ work.title }}</h3>
                  @if (work.author) {
                    <p class="work-author">{{ work.author }}</p>
                  }
                  @if (work.tradition) {
                    <p class="work-tradition">{{ work.tradition }}</p>
                  }
                </div>
              } @empty {
                <div class="empty-state">
                  <p>No works found matching your filters.</p>
                </div>
              }
            </div>

            <div class="library-footer">
              <p class="results-count">
                Showing {{ filteredWorks().length }} of {{ allWorks().length }} works
              </p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .library-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1rem;
      backdrop-filter: blur(4px);
    }

    .library-content {
      background: white;
      border-radius: 16px;
      max-width: 1200px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .library-header {
      padding: 1.5rem 2rem;
      border-bottom: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .library-header h2 {
      margin: 0;
      font-size: 1.75rem;
      color: #2c3e50;
      font-weight: 700;
    }

    .close-button {
      background: none;
      border: none;
      font-size: 1.75rem;
      cursor: pointer;
      color: #666;
      padding: 0.25rem 0.5rem;
      line-height: 1;
      transition: color 0.2s;
    }

    .close-button:hover {
      color: #333;
    }

    .library-filters {
      padding: 1.5rem 2rem;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 1rem;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #495057;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-input,
    .filter-select {
      padding: 0.625rem 0.875rem;
      border: 1px solid #ced4da;
      border-radius: 6px;
      font-size: 0.95rem;
      background: white;
      transition: all 0.2s;
    }

    .filter-input:focus,
    .filter-select:focus {
      outline: none;
      border-color: #2c3e50;
      box-shadow: 0 0 0 3px rgba(44, 62, 80, 0.1);
    }

    .library-body {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
    }

    .loading,
    .error {
      padding: 3rem;
      text-align: center;
      font-size: 1.1rem;
      color: #666;
    }

    .error {
      color: #dc3545;
    }

    .works-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .work-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }

    .work-card:hover {
      border-color: #2c3e50;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }

    .work-type-badge {
      position: absolute;
      top: 0;
      right: 0;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom-left-radius: 8px;
    }

    .work-type-badge[data-type="book"] {
      background: #e3f2fd;
      color: #1565c0;
    }

    .work-type-badge[data-type="catechism"] {
      background: #f3e5f5;
      color: #6a1b9a;
    }

    .work-type-badge[data-type="confession"] {
      background: #fff3e0;
      color: #e65100;
    }

    .work-type-badge[data-type="creed"] {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .work-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2c3e50;
      line-height: 1.4;
      padding-right: 4rem;
    }

    .work-author {
      margin: 0 0 0.375rem 0;
      font-size: 0.95rem;
      color: #495057;
      font-style: italic;
    }

    .work-tradition {
      margin: 0;
      font-size: 0.875rem;
      color: #6c757d;
      font-weight: 500;
    }

    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: #6c757d;
    }

    .empty-state p {
      margin: 0;
      font-size: 1.125rem;
    }

    .library-footer {
      padding: 1rem 2rem;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
      text-align: center;
    }

    .results-count {
      margin: 0;
      font-size: 0.875rem;
      color: #6c757d;
      font-weight: 500;
    }

    @media (max-width: 1024px) {
      .library-filters {
        grid-template-columns: 1fr;
      }

      .works-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }
    }

    @media (max-width: 640px) {
      .library-content {
        max-height: 95vh;
      }

      .library-header {
        padding: 1rem 1.5rem;
      }

      .library-header h2 {
        font-size: 1.5rem;
      }

      .library-filters {
        padding: 1rem 1.5rem;
      }

      .library-body {
        padding: 1.5rem;
      }

      .works-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LibraryModalComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/works';

  // Outputs
  workSelected = output<WorkSelection>();
  modalClosed = output<void>();

  // State
  allWorks = signal<WorkItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Filters
  searchTerm = signal('');
  selectedType = signal('');
  selectedTradition = signal('');
  selectedAuthor = signal('');

  // Computed values
  availableTraditions = computed(() => {
    const traditions = new Set(
      this.allWorks()
        .map(w => w.tradition)
        .filter(t => t !== null) as string[]
    );
    return Array.from(traditions).sort();
  });

  availableAuthors = computed(() => {
    const authors = new Set(
      this.allWorks()
        .map(w => w.author)
        .filter(a => a !== null) as string[]
    );
    return Array.from(authors).sort();
  });

  filteredWorks = computed(() => {
    let works = this.allWorks();

    // Apply search filter
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      works = works.filter(w =>
        w.title.toLowerCase().includes(search) ||
        w.author?.toLowerCase().includes(search)
      );
    }

    // Apply type filter
    if (this.selectedType()) {
      works = works.filter(w => w.type === this.selectedType());
    }

    // Apply tradition filter
    if (this.selectedTradition()) {
      works = works.filter(w => w.tradition === this.selectedTradition());
    }

    // Apply author filter
    if (this.selectedAuthor()) {
      works = works.filter(w => w.author === this.selectedAuthor());
    }

    return works;
  });

  ngOnInit() {
    this.loadLibrary();
  }

  private async loadLibrary() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // For now, fetch all works from the API
      // In the future, this could be paginated or have server-side filtering
      const response = await this.http.get<LibraryResponse>(`${this.apiUrl}`).toPromise();

      if (response) {
        this.allWorks.set(response.works);
      }
    } catch (err) {
      console.error('Error loading library:', err);
      this.error.set('Failed to load library. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }


  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      book: 'Book',
      catechism: 'Catechism',
      confession: 'Confession',
      creed: 'Creed'
    };
    return labels[type] || type;
  }

  selectWork(work: WorkItem) {
    this.workSelected.emit({
      slug: work.slug,
      title: work.title,
      type: work.type
    });
    this.close();
  }

  close() {
    this.modalClosed.emit();
  }
}
