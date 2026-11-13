// @wyatt/core: the control library for WyattERP's strands (design/specs/domain/architecture.md §11).
// Each module has its own entry point (`@wyatt/core/catalog`, later `@wyatt/core/parties`…),
// so an app that works in one module loads only that module. This root entry carries what all
// modules share.
export { type ModuleKey, type ModuleInfo, MODULES, moduleInfo } from './modules.js';
export { type Result, type CoreError, type CoreErrorKind, ok, fail } from './result.js';
export { openMemoryDb } from './sql.js';
