import { Component, OnInit, OnDestroy, signal, inject, HostListener, computed, effect, ViewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WorkUnitService, type WorkUnitDetailResponse, type FlagType } from '../services/work-unit.service';
import { applyTransform, getTransformLabel, type TransformName, getFlagLabel, getFlagDescription } from '@org/database/browser';
import { marked } from 'marked';

interface DiffLine {
  type: 'same' | 'removed' | 'added';
  text: string;
  lineNumber?: number;
}

import { TransformRangeDialogComponent } from './transform-range-dialog.component';

@Component({
  selector: 'app-work-unit-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TransformRangeDialogComponent],
  template: `
    <div class="editor-container">
      <!-- Header with navigation -->
      <header class="editor-header">
        <div class="header-content">
          <div class="header-left">
            <button class="back-button" (click)="goBack()" title="Escape to return">
              ← Back
            </button>
            <div class="work-info">
              <h1>{{ workTitle() }}</h1>
              <p class="position-info">
                {{ unitLabel() }} {{ position() }} of {{ total() }}
                @if (isDirty()) {
                  <span class="dirty-indicator" title="Unsaved changes">●</span>
                }
              </p>
              @if (currentFlags().length > 0) {
                <div class="flags-display">
                  @for (flag of currentFlags(); track flag) {
                    <span class="flag-badge" [class]="'flag-' + flag" [title]="getFlagDescription(flag)">
                      {{ getFlagLabel(flag) }}
                    </span>
                  }
                </div>
              }
            </div>
          </div>

          <div class="header-controls">
            <div class="hotkey-toggle">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  [(ngModel)]="hotkeyModeAlt"
                  (change)="onHotkeyModeChange()" />
                <span>Navigation: {{ hotkeyModeAlt ? 'Alt+Arrow' : 'Arrow keys' }}</span>
              </label>
            </div>

            <button
              class="nav-btn"
              (click)="navigatePrev()"
              [disabled]="!hasPrev() || saving()"
              [title]="hotkeyModeAlt ? 'Alt+Left arrow' : 'Left arrow (when not editing)'">
              ← Prev
            </button>

            <button
              class="nav-btn"
              (click)="navigateNext()"
              [disabled]="!hasNext() || saving()"
              [title]="hotkeyModeAlt ? 'Alt+Right arrow' : 'Right arrow (when not editing)'">
              Next →
            </button>

            <button
              class="nav-btn nav-flagged-btn"
              (click)="navigateNextFlagged()"
              [disabled]="saving() || loadingNextFlagged()"
              title="Jump to next flagged WorkUnit">
              {{ loadingNextFlagged() ? 'Searching...' : 'Next Flagged ⚑' }}
            </button>

            <div class="save-group">
              <button
                class="save-btn"
                (click)="manualSave()"
                [disabled]="!isDirty() || saving()"
                [class.dirty]="isDirty()"
                title="Ctrl/Cmd + S">
                @if (saving()) {
                  <span class="spinner"></span>
                  Saving...
                } @else {
                  Save
                }
              </button>
              @if (lastSaved()) {
                <span class="last-saved">
                  Saved {{ getTimeSinceLastSave() }}
                </span>
              }
              @if (saveError()) {
                <span class="save-status error" title="{{ saveError() }}">
                  ✗ {{ saveError() }}
                </span>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Main 3-column layout -->
      @if (loading()) {
        <div class="loading-container">
          <p>Loading work unit...</p>
        </div>
      } @else if (error()) {
        <div class="error-container">
          <p>{{ error() }}</p>
          <button (click)="reload()">Retry</button>
        </div>
      } @else {
        <div class="editor-main">
          <!-- Left: Text Editor -->
          <div class="panel editor-panel">
            <div class="panel-header">
              <h2>Text Editor</h2>
              <div class="editor-controls">
                <button
                  class="toggle-actions-btn"
                  (click)="toggleActions()"
                  [class.active]="showActions()"
                  title="Toggle actions panel">
                  {{ showActions() ? 'Hide' : 'Show' }} Actions
                </button>
                <button
                  class="toggle-diff-btn"
                  (click)="toggleDiffView()"
                  [class.active]="showDiffView()"
                  title="Toggle diff view">
                  {{ showDiffView() ? 'Hide' : 'Show' }} Diff
                </button>
                <div class="status-indicator">
                  <label for="status-select">Status:</label>
                  <select
                    id="status-select"
                    [(ngModel)]="currentStatus"
                    (change)="markChanged()"
                    class="status-select">
                    <option value="AUTO">Auto</option>
                    <option value="EDITED">Edited</option>
                    <option value="REVIEWED">Reviewed</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Actions Panel -->
            @if (showActions()) {
              <div class="actions-panel">
                <div class="actions-header">
                  <strong>Quick Actions</strong>
                  <span class="actions-hint">Apply to selection or whole text</span>
                </div>
                <div class="actions-buttons">
                  <button
                    class="action-btn"
                    (click)="applyAction('promote-heading')"
                    title="Add # prefix to lines">
                    Promote Heading
                  </button>
                  <button
                    class="action-btn"
                    (click)="applyAction('demote-heading')"
                    title="Remove # prefix from lines">
                    Demote Heading
                  </button>
                  <button
                    class="action-btn"
                    (click)="applyAction('mark-paragraph')"
                    title="Add ¶ prefix to lines">
                    Mark Paragraph
                  </button>
                  <button
                    class="action-btn"
                    (click)="applyAction('dehyphenate')"
                    title="Join hyphenated line breaks">
                    Dehyphenate
                  </button>
                  <button
                    class="action-btn"
                    (click)="applyAction('fix-drop-cap')"
                    title="Fix drop-cap spacing">
                    Fix Drop-Cap
                  </button>
                  <button
                    class="action-btn apply-range-btn"
                    (click)="showRangeDialog()"
                    title="Apply transform to multiple pages">
                    Apply to Range...
                  </button>
                </div>
              </div>
            }

            <div class="panel-content">
              @if (!showDiffView()) {
                <!-- Regular editor -->
                <textarea
                  #editorTextarea
                  class="text-editor"
                  [(ngModel)]="currentText"
                  (ngModelChange)="onTextChange()"
                  placeholder="Edit text here..."
                  spellcheck="true"></textarea>
                <div class="editor-hints">
                  <p><strong>Format markers:</strong></p>
                  <ul>
                    <li><code>#</code> - Heading or section marker</li>
                    <li><code>¶</code> - Indented paragraph</li>
                  </ul>
                </div>
              } @else {
                <!-- Diff view -->
                <div class="diff-container">
                  <div class="diff-panel">
                    <div class="diff-header">Original (Normalized)</div>
                    <div class="diff-content">
                      @for (line of diffLines().left; track $index) {
                        <div class="diff-line" [class]="'diff-' + line.type">
                          <span class="line-number">{{ line.lineNumber }}</span>
                          <span class="line-text">{{ line.text }}</span>
                        </div>
                      }
                    </div>
                  </div>
                  <div class="diff-panel">
                    <div class="diff-header">Current (Edited)</div>
                    <div class="diff-content">
                      @for (line of diffLines().right; track $index) {
                        <div class="diff-line" [class]="'diff-' + line.type">
                          <span class="line-number">{{ line.lineNumber }}</span>
                          <span class="line-text">{{ line.text }}</span>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Right: Live Preview -->
          <div class="panel preview-panel">
            <div class="panel-header">
              <h2>Preview</h2>
              <span class="panel-subtitle">Live rendering</span>
            </div>
            <div class="panel-content preview-content">
              <div class="preview-render markdown-body" [innerHTML]="renderedMarkdown()"></div>
            </div>
          </div>
        </div>
      }

      <!-- Range Transform Dialog -->
      @if (showRangeModal()) {
        <app-transform-range-dialog
          [workId]="currentWorkId()"
          [currentPosition]="position()"
          [total]="total()"
          (closed)="closeRangeDialog()">
        </app-transform-range-dialog>
      }
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--surface-1, #f8f9fa);
    }

    /* Header */
    .editor-header {
      background: white;
      border-bottom: 2px solid var(--border-subtle, #e1e4e8);
      padding: 0.75rem 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 100%;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-button {
      padding: 0.5rem 1rem;
      background: var(--surface-2, #e9ecef);
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .back-button:hover {
      background: var(--surface-3, #dee2e6);
    }

    .work-info h1 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-strong, #1a1a1a);
    }

    .position-info {
      margin: 0.25rem 0 0 0;
      font-size: 0.85rem;
      color: var(--text-muted, #6c757d);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dirty-indicator {
      color: #f59e0b;
      font-size: 1.2rem;
      line-height: 1;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .flags-display {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.5rem;
    }

    .flag-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-radius: 3px;
      border: 1px solid;
    }

    .flag-HEADING_SUSPECT {
      background: #fef3c7;
      color: #92400e;
      border-color: #fbbf24;
    }

    .flag-FOOTNOTE_SUSPECT {
      background: #dbeafe;
      color: #1e3a8a;
      border-color: #60a5fa;
    }

    .flag-METADATA_SUSPECT {
      background: #f3e8ff;
      color: #6b21a8;
      border-color: #c084fc;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hotkey-toggle {
      font-size: 0.8rem;
      color: var(--text-muted, #6c757d);
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
    }

    .toggle-label input[type="checkbox"] {
      cursor: pointer;
    }

    .nav-btn {
      padding: 0.5rem 1rem;
      background: var(--brand-600, #2563eb);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .nav-btn:hover:not(:disabled) {
      background: var(--brand-700, #1d4ed8);
    }

    .nav-btn:disabled {
      background: #cbd5e0;
      cursor: not-allowed;
    }

    .nav-flagged-btn {
      background: #f59e0b;
      border-color: #d97706;
    }

    .nav-flagged-btn:hover:not(:disabled) {
      background: #d97706;
    }

    .save-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .save-btn {
      padding: 0.5rem 1.25rem;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .save-btn:hover:not(:disabled) {
      background: #15803d;
    }

    .save-btn.dirty {
      background: #f59e0b;
    }

    .save-btn.dirty:hover:not(:disabled) {
      background: #d97706;
    }

    .save-btn:disabled {
      background: #cbd5e0;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .last-saved {
      font-size: 0.75rem;
      color: var(--text-muted, #6c757d);
      font-style: italic;
    }

    .save-status {
      font-size: 0.85rem;
      font-weight: 500;
    }

    .save-status.error {
      color: #dc2626;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Main 3-column layout */
    .editor-main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      padding: 1rem;
      height: calc(100vh - 80px);
      overflow: hidden;
    }

    .panel {
      display: flex;
      flex-direction: column;
      background: white;
      border: 1px solid var(--border-subtle, #e1e4e8);
      border-radius: 6px;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--surface-2, #f8f9fa);
      border-bottom: 1px solid var(--border-subtle, #e1e4e8);
    }

    .panel-header h2 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-strong, #1a1a1a);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .panel-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted, #6c757d);
    }

    .editor-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .toggle-diff-btn {
      padding: 0.35rem 0.75rem;
      background: var(--surface-2, #f8f9fa);
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-diff-btn:hover {
      background: var(--surface-3, #e9ecef);
    }

    .toggle-actions-btn {
      padding: 0.35rem 0.75rem;
      background: var(--surface-2, #f8f9fa);
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-actions-btn:hover {
      background: var(--surface-3, #e9ecef);
    }

    .toggle-actions-btn.active {
      background: #16a34a;
      color: white;
      border-color: #15803d;
    }

    .toggle-diff-btn.active {
      background: var(--brand-600, #2563eb);
      color: white;
      border-color: var(--brand-700, #1d4ed8);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    /* Actions Panel */
    .actions-panel {
      padding: 0.75rem 1rem;
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
    }

    .actions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .actions-header strong {
      font-size: 0.85rem;
      color: #15803d;
    }

    .actions-hint {
      font-size: 0.75rem;
      color: #16a34a;
      font-style: italic;
    }

    .actions-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.4rem 0.75rem;
      background: white;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
      color: #15803d;
    }

    .action-btn:hover {
      background: #dcfce7;
      border-color: #86efac;
    }

    .action-btn.apply-range-btn {
      background: var(--brand-600, #2563eb);
      color: white;
      border-color: var(--brand-700, #1d4ed8);
    }

    .action-btn.apply-range-btn:hover {
      background: var(--brand-700, #1d4ed8);
    }

    .status-select {
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .panel-content {
      flex: 1;
      overflow: auto;
      padding: 1rem;
    }

    /* Editor Panel */
    .text-editor {
      width: 100%;
      min-height: 400px;
      padding: 1rem;
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.6;
      resize: vertical;
    }

    .editor-hints {
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--surface-2, #f8f9fa);
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .editor-hints p {
      margin: 0 0 0.5rem 0;
    }

    .editor-hints ul {
      margin: 0;
      padding-left: 1.5rem;
    }

    .editor-hints li {
      margin-bottom: 0.25rem;
    }

    .editor-hints code {
      background: white;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      font-family: monospace;
    }

    /* Diff View */
    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      height: 100%;
    }

    .diff-panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-subtle, #dee2e6);
      border-radius: 4px;
      overflow: hidden;
    }

    .diff-header {
      padding: 0.5rem 0.75rem;
      background: var(--surface-2, #f8f9fa);
      border-bottom: 1px solid var(--border-subtle, #dee2e6);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-strong, #1a1a1a);
    }

    .diff-content {
      flex: 1;
      overflow: auto;
      background: white;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .diff-line {
      display: flex;
      padding: 0.2rem 0.5rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .diff-line.diff-same {
      background: white;
      color: #333;
    }

    .diff-line.diff-removed {
      background: #fee;
      color: #c33;
    }

    .diff-line.diff-added {
      background: #efe;
      color: #3c3;
    }

    .line-number {
      display: inline-block;
      width: 3rem;
      text-align: right;
      color: #999;
      margin-right: 1rem;
      user-select: none;
      flex-shrink: 0;
    }

    .line-text {
      flex: 1;
      min-width: 0;
    }

    /* Preview Panel */
    .preview-content {
      background: #fafbfc;
    }

    .preview-render {
      font-family: var(--font-serif, 'Georgia', serif);
      line-height: 1.8;
      color: #23364b;
    }

    .preview-paragraph {
      font-size: 1.05rem;
      margin: 0 0 1rem 0;
      line-height: 1.8;
      white-space: pre-line;
    }

    .preview-paragraph.indented {
      text-indent: 2em;
    }

    .preview-paragraph:last-child {
      margin-bottom: 0;
    }

    /* Markdown Body Styles */
    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      color: #1a1a1a;
    }

    .markdown-body h1 {
      font-size: 2em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.3em;
    }

    .markdown-body h2 {
      font-size: 1.5em;
    }

    .markdown-body h3 {
      font-size: 1.25em;
    }

    .markdown-body p {
      margin-top: 0;
      margin-bottom: 16px;
      text-align: justify;
    }

    .markdown-body blockquote {
      padding: 0 1em;
      color: #6c757d;
      border-left: 0.25em solid #dfe2e5;
    }

    /* Loading/Error states */
    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 80px);
      color: var(--text-muted, #6c757d);
    }

    .error-container {
      color: #dc2626;
    }

    .error-container button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: var(--brand-600, #2563eb);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    /* Responsive */
    @media (max-width: 1400px) {
      .editor-main {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
        height: auto;
      }

      .panel {
        min-height: 400px;
      }
    }
  `]
})
export class WorkUnitEditorComponent implements OnInit, OnDestroy {
  private workUnitService = inject(WorkUnitService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private sanitizer = inject(DomSanitizer);
  private isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;

  // Route params
  private workId = signal<string>('');
  private workUnitId = signal<string>('');

  // Data state
  private data = signal<WorkUnitDetailResponse | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Edit state
  currentText = '';
  currentStatus: 'AUTO' | 'EDITED' | 'REVIEWED' = 'AUTO';
  private savedText = signal(''); // The text as it exists in the database
  private savedStatus = signal<'AUTO' | 'EDITED' | 'REVIEWED'>('AUTO');
  private currentTextSignal = signal('');
  saving = signal(false);
  saveError = signal<string | null>(null);
  lastSaved = signal<Date | null>(null);

  // Auto-save
  private autoSaveTimer?: ReturnType<typeof setTimeout>;
  private readonly AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

  // Diff view
  showDiffView = signal(false);

  // Actions panel
  showActions = signal(false);
  showRangeModal = signal(false);

  // Keyboard mode
  hotkeyModeAlt = false; // false = plain arrows, true = Alt+arrows

  // Computed values
  workTitle = signal('');
  unitLabel = signal('Page');
  position = signal(0);
  total = signal(0);
  positionIndex = signal(0);
  pdfPageNumber = signal<number | null>(null);
  currentWorkId = signal<string>('');
  currentFlags = signal<FlagType[]>([]);
  hasPrev = signal(false);
  hasNext = signal(false);

  // Prefetch state

  // Next flagged navigation
  loadingNextFlagged = signal(false);

  // Helper methods for flags
  getFlagLabel = getFlagLabel;
  getFlagDescription = getFlagDescription;

  // Computed dirty state
  isDirty = computed(() => {
    return (
      this.currentTextSignal() !== this.savedText() ||
      this.currentStatus !== this.savedStatus()
    );
  });

  // Computed diff lines
  diffLines = computed(() => {
    const original = this.savedText();
    const current = this.currentTextSignal();
    return this.computeDiff(original, current);
  });

  ngOnInit() {
    // Load hotkey preference from localStorage (browser only)
    if (this.isBrowser) {
      const hotkeyPref = localStorage.getItem('workunit-editor-hotkey-mode');
      if (hotkeyPref === 'alt') {
        this.hotkeyModeAlt = true;
      }
    }

    // Get route params
    this.route.paramMap.subscribe(async params => {
      const workId = params.get('workId');
      const workUnitId = params.get('workUnitId');

      if (!workId) {
        this.error.set('No work ID provided');
        return;
      }

      this.workId.set(workId);

      if (workUnitId) {
        // Direct work unit navigation
        this.workUnitId.set(workUnitId);
        this.loadWorkUnit();
      } else {
        // Load first work unit for this work
        try {
          const firstUnitId = await this.workUnitService.getFirstWorkUnitId(workId);
          if (firstUnitId) {
            // Navigate to URL with work unit ID (replaceUrl to avoid history entry)
            this.router.navigate(['/admin/works', workId, firstUnitId], { replaceUrl: true });
          } else {
            this.error.set('No work units found for this work');
          }
        } catch (err) {
          console.error('Error loading first work unit:', err);
          this.error.set('Failed to load work units');
        }
      }
    });
  }

  ngOnDestroy() {
    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  async loadWorkUnit() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.workUnitService.getWorkUnit(this.workUnitId());
      this.data.set(response);

      // Set edit state - prefer editedText if present, otherwise use contentText
      const displayText = response.workUnit.editedText || response.workUnit.contentText;
      this.currentText = displayText;
      this.currentTextSignal.set(displayText);
      this.currentStatus = response.workUnit.status;

      // Save the persisted state for dirty tracking
      this.savedText.set(displayText);
      this.savedStatus.set(response.workUnit.status);

      // Clear error state
      this.saveError.set(null);

      // Set computed values
      this.workTitle.set(response.work.title);
      this.position.set(response.navigation.position);
      this.total.set(response.navigation.total);
      this.positionIndex.set(response.workUnit.positionIndex);
      this.pdfPageNumber.set(response.workUnit.pdfPageNumber);
      this.currentWorkId.set(response.workUnit.workId);
      this.currentFlags.set(response.workUnit.flags || []);
      this.hasPrev.set(response.navigation.prevId !== null);
      this.hasNext.set(response.navigation.nextId !== null);

      // Set unit label based on work type
      this.unitLabel.set(this.getUnitLabelForType(response.work.type));

      // Prefetch adjacent pages
      this.prefetchAdjacentPages();
    } catch (err) {
      console.error('Error loading work unit:', err);
      this.error.set('Failed to load work unit. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private getUnitLabelForType(type: string): string {
    if (type === 'book') return 'Page';
    if (type === 'catechism') return 'Q.';
    if (type === 'confession') return 'Article';
    if (type === 'creed') return 'Section';
    return 'Unit';
  }

  onTextChange() {
    // Update signal for dirty detection
    this.currentTextSignal.set(this.currentText);

    // Clear previous save error
    if (this.saveError()) {
      this.saveError.set(null);
    }

    // Debounce auto-save
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Don't auto-save if in diff view mode (user is reviewing)
    if (!this.showDiffView()) {
      this.autoSaveTimer = setTimeout(() => {
        if (this.isDirty() && !this.saving()) {
          this.autoSave();
        }
      }, this.AUTO_SAVE_DELAY);
    }
  }

  markChanged() {
    // Update signal
    this.currentTextSignal.set(this.currentText);

    // Clear save error
    if (this.saveError()) {
      this.saveError.set(null);
    }
  }

  onHotkeyModeChange() {
    // Store preference in localStorage (browser only)
    if (this.isBrowser) {
      localStorage.setItem('workunit-editor-hotkey-mode', this.hotkeyModeAlt ? 'alt' : 'plain');
    }
  }

  async manualSave() {
    return this.save();
  }

  private async autoSave() {
    console.log('Auto-saving...');
    return this.save();
  }

  private async save(): Promise<boolean> {
    if (!this.isDirty() || this.saving()) {
      return true; // Nothing to save or already saving
    }

    this.saving.set(true);
    this.saveError.set(null);

    try {
      const updates: { editedText?: string; status?: 'AUTO' | 'EDITED' | 'REVIEWED' } = {};

      // Only send editedText if it differs from contentText
      const currentData = this.data();
      if (currentData && this.currentText !== currentData.workUnit.contentText) {
        updates.editedText = this.currentText;
      } else if (currentData && this.currentText === currentData.workUnit.contentText) {
        // Clear editedText if we've reverted to original contentText
        updates.editedText = '';
      }

      if (this.currentStatus !== this.savedStatus()) {
        updates.status = this.currentStatus;
      }

      await this.workUnitService.updateWorkUnit(this.workUnitId(), updates);

      // Update saved state
      this.savedText.set(this.currentText);
      this.savedStatus.set(this.currentStatus);
      this.lastSaved.set(new Date());

      return true;
    } catch (err) {
      console.error('Error saving work unit:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to save';
      this.saveError.set(errorMsg);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  getTimeSinceLastSave(): string {
    const saved = this.lastSaved();
    if (!saved) return '';

    const seconds = Math.floor((Date.now() - saved.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  async navigatePrev() {
    const currentData = this.data();
    if (!currentData || !currentData.navigation.prevId || this.saving()) return;

    // Auto-save before navigating if dirty
    if (this.isDirty()) {
      const saved = await this.save();
      if (!saved) {
        // Don't navigate if save failed
        return;
      }
    }

    // Navigate to prev work unit
    await this.router.navigate(['/admin/works', this.workId(), currentData.navigation.prevId]);
  }

  async navigateNext() {
    const currentData = this.data();
    if (!currentData || !currentData.navigation.nextId || this.saving()) return;

    // Auto-save before navigating if dirty
    if (this.isDirty()) {
      const saved = await this.save();
      if (!saved) {
        // Don't navigate if save failed
        return;
      }
    }

    // Navigate to next work unit
    await this.router.navigate(['/admin/works', this.workId(), currentData.navigation.nextId]);
  }

  toggleDiffView() {
    this.showDiffView.update(v => !v);
  }

  toggleActions() {
    this.showActions.update(v => !v);
  }

  applyAction(transformName: TransformName) {
    const textarea = this.editorTextarea?.nativeElement;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection) {
      // Apply to selection only
      const selectedText = this.currentText.substring(selectionStart, selectionEnd);
      const transformedSelection = applyTransform(transformName, selectedText);

      // Replace selection with transformed text
      this.currentText =
        this.currentText.substring(0, selectionStart) +
        transformedSelection +
        this.currentText.substring(selectionEnd);

      // Update signal and mark changed
      this.currentTextSignal.set(this.currentText);
      this.markChanged();

      // Restore selection position
      setTimeout(() => {
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionStart + transformedSelection.length;
        textarea.focus();
      }, 0);
    } else {
      // Apply to whole text
      this.currentText = applyTransform(transformName, this.currentText);
      this.currentTextSignal.set(this.currentText);
      this.markChanged();
      textarea.focus();
    }
  }

  showRangeDialog() {
    this.showRangeModal.set(true);
  }

  closeRangeDialog() {
    this.showRangeModal.set(false);
  }

  async navigateNextFlagged() {
    if (this.loadingNextFlagged() || this.saving()) return;

    this.loadingNextFlagged.set(true);

    try {
      // Auto-save before navigating
      if (this.isDirty()) {
        const saved = await this.save();
        if (!saved) {
          this.loadingNextFlagged.set(false);
          return;
        }
      }

      // Get flagged WorkUnits starting after current position
      const response = await this.workUnitService.getWorkUnitsForBook(
        this.currentWorkId(),
        {
          status: 'AUTO', // Only look at AUTO status units
          limit: 1,
          offset: this.position(), // Start after current position
        }
      );

      // Check if any have flags
      const nextFlagged = response.workUnits.find(u => u.flags.length > 0);

      if (nextFlagged) {
        // Navigate to the flagged unit
        await this.router.navigate(['/admin/works', this.workId(), nextFlagged.id]);
      } else {
        // No more flagged units, show message
        alert('No more flagged WorkUnits found in AUTO status.');
      }
    } catch (err) {
      console.error('Error finding next flagged:', err);
      alert('Failed to find next flagged WorkUnit.');
    } finally {
      this.loadingNextFlagged.set(false);
    }
  }

  private computeDiff(original: string, current: string): {
    left: DiffLine[];
    right: DiffLine[];
  } {
    const originalLines = original.split('\n');
    const currentLines = current.split('\n');

    const left: DiffLine[] = [];
    const right: DiffLine[] = [];

    // Simple line-by-line diff (not a full LCS algorithm, just simple comparison)
    const maxLen = Math.max(originalLines.length, currentLines.length);

    for (let i = 0; i < maxLen; i++) {
      const origLine = originalLines[i] ?? '';
      const currLine = currentLines[i] ?? '';

      if (origLine === currLine) {
        // Same line
        left.push({ type: 'same', text: origLine, lineNumber: i + 1 });
        right.push({ type: 'same', text: currLine, lineNumber: i + 1 });
      } else {
        // Different lines
        if (i < originalLines.length) {
          left.push({ type: 'removed', text: origLine, lineNumber: i + 1 });
        }
        if (i < currentLines.length) {
          right.push({ type: 'added', text: currLine, lineNumber: i + 1 });
        }
      }
    }

    return { left, right };
  }

  goBack() {
    // Navigate back to works list
    this.router.navigate(['/admin/works']);
  }

  reload() {
    this.loadWorkUnit();
  }

  // Computed signal for rendered markdown
  renderedMarkdown = computed(() => {
    const content = this.currentTextSignal();
    if (!content) return this.sanitizer.bypassSecurityTrustHtml('');

    try {
      const html = marked.parse(content, { async: false });
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (err) {
      console.error('Markdown rendering error:', err);
      return this.sanitizer.bypassSecurityTrustHtml('<p>Error rendering markdown</p>');
    }
  });

  getPreviewParagraphs(): Array<{ text: string; isIndented: boolean }> {
    const content = this.currentText || '';
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
      const cleanLine = isIndented ? trimmedLine.substring(1).trim() : trimmedLine;

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

  private async prefetchAdjacentPages() {
    // Prefetch adjacent WorkUnit data
    const currentData = this.data();
    if (currentData?.navigation.prevId) {
      this.prefetchWorkUnit(currentData.navigation.prevId);
    }
    if (currentData?.navigation.nextId) {
      this.prefetchWorkUnit(currentData.navigation.nextId);
    }
  }

  private async prefetchWorkUnit(workUnitId: string) {
    try {
      // Prefetch in background - just to warm the cache
      await this.workUnitService.getWorkUnit(workUnitId);
    } catch (err) {
      // Silently fail prefetch
      console.debug('Prefetch failed for work unit', workUnitId);
    }
  }

  // Keyboard shortcuts
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.manualSave();
      return;
    }

    // Escape to go back (only if not in textarea to allow canceling edit)
    const target = event.target as HTMLElement;
    if (event.key === 'Escape' && target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      this.goBack();
      return;
    }

    // Arrow key navigation
    if (this.hotkeyModeAlt) {
      // Alt+Arrow mode - works everywhere including in textareas
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.navigatePrev();
      } else if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        this.navigateNext();
      }
    } else {
      // Plain arrow mode - only when NOT in textarea/input to avoid hijacking caret
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return; // Don't interfere with text editing
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.navigatePrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.navigateNext();
      }
    }
  }
}
