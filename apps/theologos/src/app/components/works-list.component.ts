import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface Work {
  id: string;
  title: string;
  author: string | null;
  type: string;
  unitCount: number;
  reviewedCount: number;
  editedCount: number;
  autoCount: number;
}

@Component({
  selector: 'app-works-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="works-list-container">
      <header class="page-header">
        <h1>📚 Works Library</h1>
        <p class="subtitle">Select a work to review and edit</p>
      </header>

      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading works...</p>
        </div>
      }

      @if (error()) {
        <div class="error">
          <p>{{ error() }}</p>
        </div>
      }

      @if (!loading() && !error()) {
        <div class="works-grid">
          @for (work of works(); track work.id) {
            <div class="work-card" (click)="openWork(work.id)">
              <div class="work-header">
                <h2>{{ work.title }}</h2>
                @if (work.author) {
                  <p class="author">by {{ work.author }}</p>
                }
              </div>

              <div class="work-stats">
                <div class="stat-group">
                  <span class="stat-label">Total Units:</span>
                  <span class="stat-value">{{ work.unitCount }}</span>
                </div>

                <div class="status-bars">
                  <div class="status-bar">
                    <span class="status-label">✅ Reviewed:</span>
                    <div class="bar">
                      <div class="fill reviewed" [style.width.%]="getPercentage(work.reviewedCount, work.unitCount)"></div>
                    </div>
                    <span class="status-count">{{ work.reviewedCount }}</span>
                  </div>

                  <div class="status-bar">
                    <span class="status-label">✏️ Edited:</span>
                    <div class="bar">
                      <div class="fill edited" [style.width.%]="getPercentage(work.editedCount, work.unitCount)"></div>
                    </div>
                    <span class="status-count">{{ work.editedCount }}</span>
                  </div>

                  <div class="status-bar">
                    <span class="status-label">⚙️ Auto:</span>
                    <div class="bar">
                      <div class="fill auto" [style.width.%]="getPercentage(work.autoCount, work.unitCount)"></div>
                    </div>
                    <span class="status-count">{{ work.autoCount }}</span>
                  </div>
                </div>
              </div>

              <div class="work-footer">
                <span class="work-type">{{ work.type }}</span>
                <span class="open-arrow">→</span>
              </div>
            </div>
          }
        </div>
      }

      @if (!loading() && works().length === 0) {
        <div class="empty-state">
          <p>No works found.</p>
          <p class="hint">Import a book to get started.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .works-list-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      color: #1a1a1a;
    }

    .subtitle {
      margin: 0;
      color: #6c757d;
      font-size: 1rem;
    }

    .loading, .error, .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6c757d;
    }

    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto 1rem;
      border: 4px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: #2563eb;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      color: #dc2626;
    }

    .works-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .work-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .work-card:hover {
      border-color: #2563eb;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
      transform: translateY(-2px);
    }

    .work-header {
      margin-bottom: 1rem;
    }

    .work-header h2 {
      margin: 0 0 0.25rem 0;
      font-size: 1.25rem;
      color: #1a1a1a;
    }

    .author {
      margin: 0;
      color: #6c757d;
      font-size: 0.875rem;
      font-style: italic;
    }

    .work-stats {
      margin-bottom: 1rem;
    }

    .stat-group {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .stat-label {
      color: #6c757d;
      font-size: 0.875rem;
    }

    .stat-value {
      font-weight: 600;
      color: #1a1a1a;
    }

    .status-bars {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .status-bar {
      display: grid;
      grid-template-columns: 85px 1fr 35px;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
    }

    .status-label {
      color: #6c757d;
    }

    .bar {
      height: 8px;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .fill.reviewed {
      background: #10b981;
    }

    .fill.edited {
      background: #3b82f6;
    }

    .fill.auto {
      background: #f59e0b;
    }

    .status-count {
      text-align: right;
      font-weight: 600;
      color: #6c757d;
    }

    .work-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }

    .work-type {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #6c757d;
      font-weight: 600;
    }

    .open-arrow {
      font-size: 1.5rem;
      color: #2563eb;
    }

    .empty-state .hint {
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  `]
})
export class WorksListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  works = signal<Work[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    await this.loadWorks();
  }

  async loadWorks() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<{ works: Work[] }>('http://localhost:3333/api/works')
      );
      this.works.set(response.works);
    } catch (err) {
      console.error('Error loading works:', err);
      this.error.set('Failed to load works');
    } finally {
      this.loading.set(false);
    }
  }

  openWork(workId: string) {
    this.router.navigate(['/admin/works', workId]);
  }

  getPercentage(count: number, total: number): number {
    if (total === 0) return 0;
    return (count / total) * 100;
  }
}
