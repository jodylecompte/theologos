import { Component, inject, signal, output, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface UnitMetadata {
  number: number;
  displayText: string;
  hasReferences: boolean;
  firstPage?: number; // For books: first page number of this chapter
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
  firstPage?: number; // For books: navigate to this page
}

@Component({
  selector: 'app-work-unit-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selector-container">
      <button class="selector-trigger" (click)="toggleSelector()">
        <span class="current-reference">{{ getCurrentUnitDisplayLabel() }}</span>
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
                      <span class="unit-full-title">{{ unit.displayText }}</span>
                      @if (unit.hasReferences) {
                        <span class="ref-indicator" aria-label="Has references">Ref</span>
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
      max-width: 700px;
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

    .unit-selection {
      overflow-y: auto;
      padding: 1.5rem;
      flex: 1;
    }

    .loading {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
    }

    .units-list {
      display: grid;
      gap: 0.5rem;
    }

    .unit-button {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .unit-button:hover {
      background: #ffffff;
      border-color: var(--brand-500);
    }

    .unit-button.active {
      background: var(--brand-600);
      border-color: var(--brand-700);
      color: white;
    }

    .unit-full-title {
      flex: 1;
      font-size: 0.95rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .unit-button.active .unit-full-title {
      color: white;
      font-weight: 600;
    }

    .ref-indicator {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      background: #ffffff;
      font-weight: 600;
    }

    .unit-button.active .ref-indicator {
      color: #dce8f5;
      border-color: rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.12);
    }
  `]
})
export class WorkUnitSelectorComponent implements OnInit, OnChanges {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/works';

  // Debug flag - set to true to enable console logging
  private readonly DEBUG = false;

  // Inputs
  @Input() workSlug: string = 'wsc';
  @Input() currentUnitNumber: number = 1;

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
    this.currentUnit.set(this.currentUnitNumber);
    this.loadUnits();
  }

  ngOnChanges(changes: any) {
    // Reload units if workSlug changes
    if (changes['workSlug']) {
      this.currentUnit.set(this.currentUnitNumber || 1);
      this.loadUnits();
    }

    // Keep selector label synced with parent reader state
    if (changes['currentUnitNumber'] && typeof this.currentUnitNumber === 'number') {
      this.currentUnit.set(this.currentUnitNumber);
    }
  }

  private async loadUnits() {
    this.loading.set(true);
    try {
      const response = await this.http.get<WorkResponse>(`${this.apiUrl}/${this.workSlug}`).toPromise();
      if (response) {
        this.units.set(response.units);
        this.workData.set(response);

        if (this.DEBUG) {
          console.log('[WorkUnitSelector] Loaded units:', response.units);
          console.log('[WorkUnitSelector] Work type:', response.type);
          response.units.forEach(u => {
            console.log(`  Unit ${u.number}: "${this.getUnitDisplayLabel(u)}" - ${u.displayText}`);
          });
        }
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
    if (type === 'book') return 'Section';
    return 'Unit';
  }

  /**
   * Extract the chapter/section label from the displayText for a specific unit
   * For books, displayText is like "Preface: Title" or "Chapter 1: Title"
   * Extract the part before the colon as the label
   */
  getUnitDisplayLabel(unit: UnitMetadata): string {
    const type = this.workData()?.type;
    if (type === 'book' && unit.displayText) {
      const colonIndex = unit.displayText.indexOf(':');
      if (colonIndex > 0) {
        // Return part before colon (e.g., "Preface", "Chapter 1")
        return unit.displayText.substring(0, colonIndex).trim();
      }
    }
    // Fallback to unit number with type label
    return `${this.getUnitLabel()} ${unit.number}`;
  }

  /**
   * Get display label for currently selected unit
   */
  getCurrentUnitDisplayLabel(): string {
    const currentUnitNum = this.currentUnit();
    const currentUnitMeta = this.units().find(u => u.number === currentUnitNum);
    if (currentUnitMeta) {
      // For books, show full chapter name
      // For catechisms/creeds, show short label
      const type = this.workData()?.type;
      if (type === 'book') {
        return currentUnitMeta.displayText;
      }
      return this.getUnitDisplayLabel(currentUnitMeta);
    }
    // Fallback if unit not found
    return `${this.getUnitLabel()} ${currentUnitNum}`;
  }

  toggleSelector() {
    this.isOpen.update(open => !open);
  }

  closeSelector() {
    this.isOpen.set(false);
  }

  selectUnit(unitNumber: number) {
    const unit = this.units().find(u => u.number === unitNumber);

    if (this.DEBUG) {
      console.log(`[WorkUnitSelector] Selected unit ${unitNumber}: "${unit?.displayText}", firstPage: ${unit?.firstPage}`);
    }

    this.currentUnit.set(unitNumber);
    this.selectionChange.emit({
      unitNumber,
      firstPage: unit?.firstPage
    });
    this.closeSelector();
  }

  // Public method to update current unit
  updateUnit(unitNumber: number) {
    this.currentUnit.set(unitNumber);
  }
}
