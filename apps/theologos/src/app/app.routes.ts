import { Route } from '@angular/router';
import { ReaderContainerComponent } from './components/reader-container.component';
import { WorkUnitEditorComponent } from './components/work-unit-editor.component';
import { WorksListComponent } from './components/works-list.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/reader', pathMatch: 'full' },
  { path: 'reader', component: ReaderContainerComponent },
  { path: 'admin/works', component: WorksListComponent },
  { path: 'admin/works/:workId', component: WorkUnitEditorComponent },
  { path: 'admin/works/:workId/:workUnitId', component: WorkUnitEditorComponent },
];
