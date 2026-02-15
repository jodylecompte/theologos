import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer">
      <div class="footer-content">
        <p class="footer-text">
          Theologos &copy; {{ currentYear }} • A Ministry-Oriented Theological Study System
        </p>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background: linear-gradient(180deg, rgba(16, 35, 58, 0.97) 0%, rgba(13, 29, 49, 0.98) 100%);
      color: rgba(235, 242, 250, 0.78);
      border-top: 1px solid rgba(255, 255, 255, 0.16);
      padding: 0.9rem 2rem;
    }

    .footer-content {
      max-width: 1440px;
      margin: 0 auto;
      text-align: center;
    }

    .footer-text {
      margin: 0;
      font-size: 0.86rem;
      font-weight: 500;
      letter-spacing: 0.03em;
    }

    @media (max-width: 640px) {
      .app-footer {
        padding: 1rem;
      }

      .footer-text {
        font-size: 0.75rem;
      }
    }
  `]
})
export class AppFooterComponent {
  currentYear = new Date().getFullYear();
}
