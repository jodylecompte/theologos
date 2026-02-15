import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppHeaderComponent } from './components/app-header.component';
import { AppFooterComponent } from './components/app-footer.component';
import { LibraryModalComponent, type WorkSelection } from './components/library-modal.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    AppHeaderComponent,
    AppFooterComponent,
    LibraryModalComponent
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  libraryOpen = signal(false);

  constructor(private router: Router) {}

  openLibrary() {
    this.libraryOpen.set(true);
  }

  closeLibrary() {
    this.libraryOpen.set(false);
  }

  onWorkSelected(selection: WorkSelection) {
    // Navigate to reader with selected work
    this.router.navigate(['/reader'], {
      queryParams: {
        work: selection.slug,
        ...(selection.type === 'book' ? { page: 1 } : { unit: 1 })
      }
    });
    this.closeLibrary();
  }
}
