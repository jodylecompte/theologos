import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BibleReaderComponent, type NavigationChange as BibleNavChange } from './bible-reader.component';
import { WorkReaderComponent, type ReferenceClick, type NavigationChange as WorkNavChange } from './work-reader.component';

interface BibleReference {
  book: string;
  chapter: number;
}

@Component({
  selector: 'app-reader-container',
  standalone: true,
  imports: [CommonModule, BibleReaderComponent, WorkReaderComponent],
  template: `
    <div class="reader-container">
      <div class="left-pane">
        <app-bible-reader
          [initialBook]="bibleRef().book"
          [initialChapter]="bibleRef().chapter"
          [targetVerse]="targetVerse()"
          (navigationChange)="onBibleNavChange($event)">
        </app-bible-reader>
      </div>

      <div class="right-pane">
        <app-work-reader
          [workSlug]="workSlug()"
          [initialUnit]="workUnitNumber()"
          [initialPage]="workPageNumber()"
          (referenceClick)="onWorkReferenceClick($event)"
          (navigationChange)="onWorkNavChange($event)">
        </app-work-reader>
      </div>
    </div>
  `,
  styles: [`
    .reader-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      height: 100%;
      padding: 1.5rem;
      padding-bottom: 1.5rem;
      box-sizing: border-box;
    }

    .left-pane, .right-pane {
      overflow-y: auto;
      overflow-x: hidden;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    /* Mobile: stack vertically */
    @media (max-width: 1024px) {
      .reader-container {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 1rem;
        padding: 1rem;
        padding-bottom: 1rem;
      }
    }

    /* Tablet: slightly smaller gap */
    @media (max-width: 1280px) and (min-width: 1025px) {
      .reader-container {
        gap: 1.25rem;
        padding: 1.25rem;
        padding-bottom: 1.25rem;
      }
    }
  `]
})
export class ReaderContainerComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  bibleRef = signal<BibleReference>({ book: 'Genesis', chapter: 1 });
  workSlug = signal<string>('the-loveliness-of-christ'); // Default to book
  workUnitNumber = signal<number>(1);
  workPageNumber = signal<number>(1);
  targetVerse = signal<number | undefined>(undefined);

  constructor() {
    // Read URL query params on init
    this.route.queryParams.subscribe(params => {
      if (params['bible']) {
        const parts = params['bible'].split('.');
        if (parts.length === 2) {
          const book = parts[0];
          const chapter = parseInt(parts[1], 10);
          if (!isNaN(chapter)) {
            this.bibleRef.set({ book, chapter });
          }
        }
      }
      if (params['work']) {
        this.workSlug.set(params['work']);
      }
      if (params['unit']) {
        const unitNum = parseInt(params['unit'], 10);
        if (!isNaN(unitNum) && unitNum >= 1) {
          this.workUnitNumber.set(unitNum);
        }
      }
      if (params['page']) {
        const pageNum = parseInt(params['page'], 10);
        if (!isNaN(pageNum) && pageNum >= 1) {
          this.workPageNumber.set(pageNum);
        }
      }
      if (params['verse']) {
        const verseNum = parseInt(params['verse'], 10);
        if (!isNaN(verseNum)) {
          this.targetVerse.set(verseNum);
        }
      } else {
        this.targetVerse.set(undefined);
      }
    });
  }

  onWorkReferenceClick(ref: ReferenceClick) {
    // Update Bible pane to show this verse
    this.bibleRef.set({ book: ref.book, chapter: ref.chapter });
    this.targetVerse.set(ref.verse);
    this.updateUrl();
  }

  onBibleNavChange(nav: BibleNavChange) {
    // Update URL when Bible pane navigates independently
    this.bibleRef.set(nav);
    this.targetVerse.set(undefined); // Clear verse highlight
    this.updateUrl();
  }

  onWorkNavChange(nav: WorkNavChange) {
    // Update URL when work pane navigates
    if (nav.unitNumber !== undefined) {
      this.workUnitNumber.set(nav.unitNumber);
    }
    if (nav.pageNumber !== undefined) {
      this.workPageNumber.set(nav.pageNumber);
    }
    this.updateUrl();
  }

  private updateUrl() {
    const queryParams: any = {
      bible: `${this.bibleRef().book}.${this.bibleRef().chapter}`,
      work: this.workSlug()
    };

    // Include either page or unit based on what's relevant
    if (this.workPageNumber() > 1 || this.workSlug() === 'the-loveliness-of-christ') {
      queryParams.page = this.workPageNumber();
    } else if (this.workUnitNumber() > 1 || this.workSlug() === 'wsc') {
      queryParams.unit = this.workUnitNumber();
    }

    if (this.targetVerse() !== undefined) {
      queryParams.verse = this.targetVerse();
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
