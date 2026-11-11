import { tagsService } from './tags.service';

// Re-export canonical tagsService under legacy and canonical names
export { tagsService, tagsService as tagService };
export default tagsService;
