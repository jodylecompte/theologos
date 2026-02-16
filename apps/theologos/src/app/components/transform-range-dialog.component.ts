import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getTransformLabel, type TransformName } from '@org/database/browser';

interface ApplyTransformResponse {
  dryRun: boolean;
  affectedCount: number;
  affectedIds: string[];
  summary?: {
    updated: number;
    errors: number;
  };
}

@Component({
  selector: 'app-transform-range-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Apply Transform to Range</h2>
          <button class="close-btn" (click)="close()" title="Close">&times;</button>
        </div>

        <div class="modal-body">
          @if (!dryRunResult() && !applyResult()) {
            <!-- Step 1: Select transform and range -->
            <div class="form-group">
              <label for="transform-select">Transform:</label>
              <select
                id="transform-select"
                [(ngModel)]="selectedTransform"
                class="form-control">
                <option value="">-- Select Transform --</option>
                <option value="promote-heading">{{ getTransformLabel('promote-heading') }}</option>
                <option value="demote-heading">{{ getTransformLabel('demote-heading') }}</option>
                <option value="mark-paragraph">{{ getTransformLabel('mark-paragraph') }}</option>
                <option value="dehyphenate">{{ getTransformLabel('dehyphenate') }}</option>
                <option value="fix-drop-cap">{{ getTransformLabel('fix-drop-cap') }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="start-position">Start Position:</label>
              <input
                id="start-position"
                type="number"
                [(ngModel)]="startPosition"
                min="1"
                [max]="total"
                class="form-control"
                placeholder="Start page/unit number" />
              <small>Current: {{ currentPosition }}</small>
            </div>

            <div class="form-group">
              <label for="end-position">End Position:</label>
              <input
                id="end-position"
                type="number"
                [(ngModel)]="endPosition"
                min="1"
                [max]="total"
                class="form-control"
                placeholder="End page/unit number" />
              <small>Total: {{ total }}</small>
            </div>

            @if (error()) {
              <div class="error-message">
                {{ error() }}
              </div>
            }
          }

          @if (dryRunResult() && !applyResult()) {
            <!-- Step 2: Show dry run results -->
            <div class="dry-run-results">
              <h3>Preview Results</h3>
              <p>
                This will affect <strong>{{ dryRunResult()!.affectedCount }}</strong> WorkUnits
                (positions {{ startPosition }} to {{ endPosition }}).
              </p>
              <p class="warning">
                ⚠️ This action cannot be undone. Make sure you have backups or can revert changes.
              </p>
            </div>
          }

          @if (applyResult()) {
            <!-- Step 3: Show apply results -->
            <div class="apply-results">
              <h3>✓ Transform Applied</h3>
              <p>
                Updated: <strong>{{ applyResult()!.summary!.updated }}</strong> WorkUnits
              </p>
              @if (applyResult()!.summary!.errors > 0) {
                <p class="error">
                  Errors: {{ applyResult()!.summary!.errors }}
                </p>
              }
            </div>
          }
        </div>

        <div class="modal-footer">
          @if (!dryRunResult() && !applyResult()) {
            <button class="btn btn-secondary" (click)="close()">Cancel</button>
            <button
              class="btn btn-primary"
              (click)="runDryRun()"
              [disabled]="!canRunDryRun() || loading()">
              {{ loading() ? 'Checking...' : 'Preview' }}
            </button>
          }

          @if (dryRunResult() && !applyResult()) {
            <button class="btn btn-secondary" (click)="resetDialog()">Back</button>
            <button
              class="btn btn-danger"
              (click)="applyTransform()"
              [disabled]="loading()">
              {{ loading() ? 'Applying...' : 'Apply Transform' }}
            </button>
          }

          @if (applyResult()) {
            <button class="btn btn-primary" (click)="close()">Done</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
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
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e1e4e8;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      color: #1a1a1a;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6c757d;
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      color: #1a1a1a;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #1a1a1a;
    }

    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #6c757d;
      font-size: 0.85rem;
    }

    .form-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 0.95rem;
    }

    .error-message {
      padding: 0.75rem;
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      color: #c33;
      margin-top: 1rem;
    }

    .dry-run-results,
    .apply-results {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .dry-run-results h3,
    .apply-results h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: #1a1a1a;
    }

    .warning {
      padding: 0.75rem;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      color: #856404;
      margin-top: 1rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid #e1e4e8;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #5a6268;
    }

    .btn-danger {
      background: #dc2626;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #b91c1c;
    }

    .error {
      color: #dc2626;
      font-weight: 500;
    }
  `]
})
export class TransformRangeDialogComponent {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3333/api/transforms';

  @Input() workId: string = '';
  @Input() currentPosition: number = 1;
  @Input() total: number = 1;
  @Output() closed = new EventEmitter<void>();

  selectedTransform: TransformName | '' = '';
  startPosition: number = 1;
  endPosition: number = 1;

  loading = signal(false);
  error = signal<string | null>(null);
  dryRunResult = signal<ApplyTransformResponse | null>(null);
  applyResult = signal<ApplyTransformResponse | null>(null);

  getTransformLabel = getTransformLabel;

  canRunDryRun(): boolean {
    return (
      this.selectedTransform !== '' &&
      this.startPosition >= 1 &&
      this.endPosition >= this.startPosition &&
      this.endPosition <= this.total
    );
  }

  async runDryRun() {
    if (!this.canRunDryRun()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      // We need to convert position to WorkUnit IDs
      // For now, we'll use a simplified approach assuming sequential IDs
      // In a real implementation, you'd fetch the actual WorkUnit IDs by position

      const response = await this.http.post<ApplyTransformResponse>(
        `${this.apiUrl}/books/${this.workId}/work-units/apply`,
        {
          transformName: this.selectedTransform,
          startWorkUnitId: `position-${this.startPosition}`, // Placeholder
          endWorkUnitId: `position-${this.endPosition}`, // Placeholder
          dryRun: true,
        }
      ).toPromise();

      if (response) {
        this.dryRunResult.set(response);
      }
    } catch (err) {
      console.error('Dry run failed:', err);
      this.error.set('Failed to preview transform. Please check your inputs.');
    } finally {
      this.loading.set(false);
    }
  }

  async applyTransform() {
    if (!this.dryRunResult()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.http.post<ApplyTransformResponse>(
        `${this.apiUrl}/books/${this.workId}/work-units/apply`,
        {
          transformName: this.selectedTransform,
          startWorkUnitId: `position-${this.startPosition}`,
          endWorkUnitId: `position-${this.endPosition}`,
          dryRun: false,
        }
      ).toPromise();

      if (response) {
        this.applyResult.set(response);
      }
    } catch (err) {
      console.error('Apply failed:', err);
      this.error.set('Failed to apply transform.');
    } finally {
      this.loading.set(false);
    }
  }

  resetDialog() {
    this.dryRunResult.set(null);
    this.applyResult.set(null);
    this.error.set(null);
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
