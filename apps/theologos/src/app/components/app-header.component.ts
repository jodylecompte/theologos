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
          <p class="brand-kicker">Theological Study System</p>
          <h1 class="app-title">Theologos</h1>
          <p class="app-subtitle">Biblical Study & Theological Library</p>
        </div>

        <nav class="nav-buttons">
          <button class="nav-button library-button" (click)="libraryClick.emit()">
            <span class="button-icon" aria-hidden="true">Lib</span>
            <span class="button-label">Library</span>
          </button>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background:
        linear-gradient(112deg, rgba(17, 58, 102, 0.95) 0%, rgba(28, 79, 131, 0.93) 55%, rgba(44, 96, 148, 0.9) 100%);
      color: var(--text-on-dark);
      border-bottom: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: var(--shadow-2);
      position: relative;
      overflow: hidden;
    }

    .app-header::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0, rgba(255, 255, 255, 0) 40%),
        repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 12px);
    }

    .header-content {
      position: relative;
      z-index: 1;
      max-width: 1440px;
      margin: 0 auto;
      padding: 0.95rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .branding {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .brand-kicker {
      margin: 0;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.17em;
      color: rgba(235, 242, 250, 0.76);
      font-weight: 600;
    }

    .app-title {
      margin: 0;
      font-family: var(--font-serif);
      font-size: 1.65rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--text-on-dark);
      line-height: 1.3;
    }

    .app-subtitle {
      margin: 0;
      font-size: 0.84rem;
      color: rgba(235, 242, 250, 0.82);
      font-weight: 500;
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
      padding: 0.62rem 1.1rem;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.32);
      border-radius: var(--radius-sm);
      color: var(--text-on-dark);
      font-size: 0.98rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }

    .nav-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(5, 15, 30, 0.24);
    }

    .nav-button:active {
      transform: translateY(0);
    }

    .button-icon {
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      line-height: 1;
      opacity: 0.88;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 999px;
      padding: 0.12rem 0.42rem;
    }

    .button-label {
      font-family: var(--font-sans);
    }

    @media (max-width: 640px) {
      .header-content {
        padding: 0.85rem 1rem;
      }

      .app-title {
        font-size: 1.35rem;
      }

      .app-subtitle {
        font-size: 0.74rem;
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
