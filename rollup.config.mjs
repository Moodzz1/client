import { execSync } from 'child_process';

// Plugins
import { typescriptPaths as paths } from 'rollup-plugin-typescript-paths';
import { nodeResolve as node } from '@rollup/plugin-node-resolve';
import { swc, minify } from 'rollup-plugin-swc3';
import hermes from '@unboundmod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import { resolve } from 'path';

const revision = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

const hermesc = resolve(process.cwd(), 'node_modules', 'discord-hermesc');

/** @type {import('rollup').RollupOptions} */
const config = {
	input: 'src/preload.ts',
	output: [
		{
			file: 'dist/unbound.js',
			format: 'iife',
			inlineDynamicImports: true,
			strict: false
		}
	],

	plugins: [
		paths({ preserveExtensions: true, nonRelative: process.platform === 'darwin' ? false : true }),
		node(),
		json(),
		replace({ preventAssignment: true, __VERSION__: revision }),
		swc({ tsconfig: false }),
		minify({ compress: true, mangle: true }),
		hermes({ hermesc })
	],

	onwarn(warning, warn) {
		if (warning.code === 'EVAL') return;
		warn(warning);
	}
};

export default config;