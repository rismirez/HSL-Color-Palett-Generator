import generator from './en/generator.js';
import extractor from './en/extractor.js';
import access from './en/access.js';
import preview from './en/preview.js';
import systems from './en/systems.js';
import lab from './en/lab.js';

export default { ...generator, ...extractor, ...access, ...preview, ...systems, ...lab };
