import { notesService } from './notes.service';

// Re-export canonical notesService under legacy and canonical names
export { notesService, notesService as noteService };
export default notesService;
