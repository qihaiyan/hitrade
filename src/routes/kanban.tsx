import { createFileRoute } from '@tanstack/react-router';
import { KanbanPage } from '../pages/KanbanPage';

export const Route = createFileRoute('/kanban')({
  component: KanbanPage,
});