import { Component, inject, signal, output, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface UnitMetadata {
  number: number;
  displayText: string;
  hasReferences: boolean;
}

interface WorkResponse {
  slug: string;
  title: string;
  author: string | null;
  type: string;
  units: UnitMetadata[];
  totalUnits: number;
}

export interface UnitSelection {
  unitNumber: number;
}

@Component({
  selector: 'app-work-unit-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selector-container">
      <button class="selector-trigger" (click)="toggleSelector()">
        <span class="current-reference">{{ getUnitLabel() }} {{ currentUnit() }}</span>
        <span class="dropdown-icon">▼</span>
      </button>

      @if (isOpen()) {
        <div class="selector-modal" (click)="closeSelector()">
          <div class="selector-content" (click)="$event.stopPropagation()">
            <div class="selector-header">
              <h2>{{ workData()?.title || 'Select Unit' }}</h2>
              <button class="close-button" (click)="closeSelector()">✕</button>
            </div>

            <div class="unit-selection">
              @if (loading()) {
                <div class="loading">Loading...</div>
              }

              @if (units().length > 0) {
                <div class="units-list">
                  @for (unit of units(); track unit.number) {
                    <button
                      class="unit-button"
                      [class.active]="unit.number === currentUnit()"
                      (click)="selectUnit(unit.number)">
                      <span class="unit-number">{{ getUnitLabel() }} {{ unit.number }}</span>
                      <span class="unit-preview">{{ unit.displayText }}</span>
                      @if (unit.hasReferences) {
                        <span class="ref-indicator">📖</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
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
      padding: 0.75rem 1.25rem;
      background: white;
      border: 2px solid #333;
      border-radius: 6px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
    }

    .selector-trigger:hover {
      background: #f5f5f5;
      border-color: #555;
    }

    .current-reference {
      color: #333;
    }

    .dropdown-icon {
      color: #666;
      font-size: 0.8rem;
    }

    .selector-modal {
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
      padding: 1rem;
    }

    .selector-content {
      background: white;
      border-radius: 12px;
      max-width: 700px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .selector-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .selector-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
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
      color: #333;
    }

    .unit-selection {
      overflow-y: auto;
      padding: 1.5rem;
      flex: 1;
    }

    .loading {
      padding: 2rem;
      text-align: center;
      color: #666;
    }

    .units-list {
      display: grid;
      gap: 0.5rem;
    }

    .unit-button {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1rem;
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .unit-button:hover {
      background: #f0f0f0;
      border-color: #333;
    }

    .unit-button.active {
      background: #333;
      border-color: #333;
      color: white;
    }

    .unit-number {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .unit-preview {
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .unit-button.active .unit-preview {
      color: #e0e0e0;
    }

    .ref-indicator {
      font-size: 1rem;
    }
  `]
})
export class WorkUnitSelectorComponent implements OnInit, OnChanges {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/works';

  // Inputs
  @Input() workSlug: string = 'wsc';

  // Current state
  currentUnit = signal(1);

  // Output event
  selectionChange = output<UnitSelection>();

  // Modal state
  isOpen = signal(false);
  loading = signal(false);
  units = signal<UnitMetadata[]>([]);
  workData = signal<WorkResponse | null>(null);

  ngOnInit() {
    this.loadUnits();
  }

  ngOnChanges() {
    // Reload units if workSlug changes
    this.loadUnits();
  }

  private async loadUnits() {
    this.loading.set(true);
    try {
      const response = await this.http.get<WorkResponse>(`${this.apiUrl}/${this.workSlug}`).toPromise();
      if (response) {
        this.units.set(response.units);
        this.workData.set(response);
      }
    } catch (error) {
      console.error('Error loading work units:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getUnitLabel(): string {
    const type = this.workData()?.type;
    if (type === 'catechism') return 'Q.';
    if (type === 'confession') return 'Art.';
    if (type === 'creed') return '§';
    return 'Unit';
  }

  toggleSelector() {
    this.isOpen.update(open => !open);
  }

  closeSelector() {
    this.isOpen.set(false);
  }

  selectUnit(unitNumber: number) {
    this.currentUnit.set(unitNumber);
    this.selectionChange.emit({ unitNumber });
    this.closeSelector();
  }

  // Public method to update current unit
  updateUnit(unitNumber: number) {
    this.currentUnit.set(unitNumber);
  }
}
