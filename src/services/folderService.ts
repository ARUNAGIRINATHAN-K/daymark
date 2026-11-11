import { foldersService } from './folders.service';

// Re-export canonical foldersService under legacy and canonical names
export { foldersService, foldersService as folderService };
export default foldersService;
