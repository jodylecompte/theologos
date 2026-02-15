import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="header-content">
        <div class="branding">
          <h1 class="app-title">Theologos</h1>
          <p class="app-subtitle">Biblical Study & Theological Library</p>
        </div>

        <nav class="nav-buttons">
          <button class="nav-button library-button" (click)="libraryClick.emit()">
            <span class="button-icon">📚</span>
            <span class="button-label">Library</span>
          </button>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      color: white;
      border-bottom: 3px solid #1a252f;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .header-content {
      max-width: 1600px;
      margin: 0 auto;
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .branding {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .app-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: white;
      line-height: 1.3;
    }

    .app-subtitle {
      margin: 0;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 400;
      line-height: 1.3;
    }

    .nav-buttons {
      display: flex;
      gap: 0.75rem;
    }

    .nav-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      backdrop-filter: blur(10px);
    }

    .nav-button:hover {
      background: rgba(255, 255, 255, 0.25);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .nav-button:active {
      transform: translateY(0);
    }

    .button-icon {
      font-size: 1.25rem;
      line-height: 1;
    }

    .button-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    @media (max-width: 640px) {
      .header-content {
        padding: 1rem;
      }

      .app-title {
        font-size: 1.5rem;
      }

      .app-subtitle {
        font-size: 0.75rem;
      }

      .button-label {
        display: none;
      }

      .nav-button {
        padding: 0.625rem;
      }
    }
  `]
})
export class AppHeaderComponent {
  libraryClick = output<void>();
}
