import { tasksService } from './tasks.service';

// Re-export canonical tasksService under legacy and canonical names
export { tasksService, tasksService as taskService };
export default tasksService;
