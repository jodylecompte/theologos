import { Component, Input, OnChanges, SimpleChanges, signal, inject, ElementRef, ViewChild, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pdf-viewer-container">
      @if (loading()) {
        <div class="pdf-loading">
          <div class="spinner"></div>
          <p>Loading PDF page {{ pageNumber }}...</p>
        </div>
      }

      @if (error()) {
        <div class="pdf-error">
          <p>{{ error() }}</p>
          @if (noPdf()) {
            <small>No PDF available for this work</small>
          }
        </div>
      }

      <div class="pdf-canvas-wrapper" [class.hidden]="loading() || error()">
        <canvas #pdfCanvas></canvas>
      </div>
    </div>
  `,
  styles: [`
    .pdf-viewer-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      overflow: auto;
    }

    .pdf-loading,
    .pdf-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      color: var(--text-muted, #6c757d);
    }

    .pdf-error {
      color: #dc2626;
    }

    .pdf-error small {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted, #6c757d);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--brand-600, #2563eb);
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .pdf-canvas-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow: auto;
    }

    .pdf-canvas-wrapper.hidden {
      display: none;
    }

    canvas {
      max-width: 100%;
      height: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      background: white;
    }
  `]
})
export class PdfViewerComponent implements OnChanges, AfterViewInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  @Input() workId: string | null = null;
  @Input() pageNumber: number | null = null;
  @ViewChild('pdfCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  loading = signal(false);
  error = signal<string | null>(null);
  noPdf = signal(false);

  private pdfDocument: any = null;
  private currentRenderTask: any = null;
  private pdfjsLib: any = null;

  ngAfterViewInit() {
    // Initial load if inputs are set (only in browser)
    if (this.isBrowser && this.workId && this.pageNumber) {
      this.loadPage();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reload when inputs change (only in browser)
    if (this.isBrowser && (changes['workId'] || changes['pageNumber']) && !changes['workId']?.firstChange) {
      if (this.workId && this.pageNumber) {
        this.loadPage();
      }
    }
  }

  private async loadPage() {
    if (!this.isBrowser || !this.workId || !this.pageNumber || !this.canvasRef) {
      return;
    }

    // Dynamically import PDF.js only in browser
    if (!this.pdfjsLib) {
      try {
        this.pdfjsLib = await import('pdfjs-dist');
        // Configure PDF.js worker
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${this.pdfjsLib.version}/pdf.worker.min.js`;
      } catch (err) {
        console.error('Error loading PDF.js:', err);
        this.error.set('Failed to load PDF library');
        return;
      }
    }

    // Cancel any ongoing render
    if (this.currentRenderTask) {
      this.currentRenderTask.cancel();
      this.currentRenderTask = null;
    }

    this.loading.set(true);
    this.error.set(null);
    this.noPdf.set(false);

    try {
      // Load PDF document if not already loaded
      if (!this.pdfDocument) {
        const pdfUrl = `http://localhost:3333/api/pdf/works/${this.workId}`;

        try {
          this.pdfDocument = await this.pdfjsLib.getDocument(pdfUrl).promise;
        } catch (err) {
          // Check if it's a 404 (no PDF available)
          if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
            this.noPdf.set(true);
            this.error.set('PDF not available');
            return;
          }
          throw err;
        }
      }

      // Validate page number
      if (this.pageNumber > this.pdfDocument.numPages || this.pageNumber < 1) {
        this.error.set(`Invalid page number (PDF has ${this.pdfDocument.numPages} pages)`);
        return;
      }

      // Get the page
      const page = await this.pdfDocument.getPage(this.pageNumber);

      // Calculate scale to fit container
      const canvas = this.canvasRef.nativeElement;
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      const viewport = page.getViewport({ scale: 1.0 });
      const scale = (containerWidth - 32) / viewport.width; // 32px for padding
      const scaledViewport = page.getViewport({ scale: scale * 1.5 }); // 1.5x for better quality

      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render the page
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

    } catch (err) {
      console.error('Error loading PDF page:', err);
      if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
        // Ignore cancellation errors
        return;
      }
      this.error.set('Failed to load PDF page');
    } finally {
      this.loading.set(false);
    }
  }

  // Public method to prefetch a page (loads it into browser cache)
  async prefetchPage(pageNumber: number) {
    if (!this.workId || !this.pdfDocument) return;

    try {
      // Just getting the page loads it into memory
      await this.pdfDocument.getPage(pageNumber);
    } catch (err) {
      // Silently fail prefetch
      console.debug(`Prefetch failed for page ${pageNumber}`, err);
    }
  }
}
