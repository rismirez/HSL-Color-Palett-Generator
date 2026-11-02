import generator from './es/generator.js';
import extractor from './es/extractor.js';
import access from './es/access.js';
import preview from './es/preview.js';
import systems from './es/systems.js';
import lab from './es/lab.js';

export default { ...generator, ...extractor, ...access, ...preview, ...systems, ...lab };
