import { Route } from '@angular/router';
import { ReaderContainerComponent } from './components/reader-container.component';
import { WorkUnitEditorComponent } from './components/work-unit-editor.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/reader', pathMatch: 'full' },
  { path: 'reader', component: ReaderContainerComponent },
  {
    path: 'admin/books/:bookId/work-units/:workUnitId/edit',
    component: WorkUnitEditorComponent
  }
];
