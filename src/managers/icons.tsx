import type { Addon, Manifest, Resolveable } from '@typings/managers';
import type { Asset } from '@typings/api/assets';
import { createPatcher } from '@patcher';
import { findByProps } from '@api/metro';
import { ClientName } from '@constants';
import { chunkArray } from '@utilities';
import { download } from '@utilities';
import { Image } from 'react-native';
import { Strings } from '@api/i18n';
import Storage from '@api/storage';
import fs from '@api/fs';

import Manager, { ManagerType } from './base';

export type PackManifest = Manifest & { type: 'github' | 'other'; };
export type Pack = { bundle: string; manifest: PackManifest; };
export const defaultPack = {
	manifest: {
		id: 'default',
		name: 'Default',
		description: 'The default Discord icon pack. Nothing special here!',
		authors: [{
			name: 'Discord',
			id: '263689920210534400'
		}],
		bundle: 'Default',
		icon: 'Discord',
		version: '1.0.0'
	},
	bundle: 'Default'
} as unknown as Pack;

const registry = findByProps('registerAsset', { lazy: true });

class Icons extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'png';
	public signal: AbortSignal;

	constructor() {
		super(ManagerType.Icons);

		this.patcher = createPatcher('icons');
		this.icon = 'ic_star_filled';

		// Overwrite the name to 'Icons' as 'Packs' doesn't sound right,
		// however you want to install a 'pack' not an 'icon',
		// so the 'type' property will stay the same ('pack').
		this.name = 'Icons';
	}

	get applied() {
		return this.settings.get('applied', defaultPack);
	}

	initialize(): void {
		for (const pack of this.settings.get('packs', [defaultPack])) {
			const { manifest, bundle } = pack;

			this.load(bundle, manifest);
		}
	}

	override getContextItems(addon: Addon) {
		if (addon.data.id === 'default')
			return [];

		return this.getBaseContextItems(addon);
	}

	override async fetchBundle(_: string, manifest: PackManifest, signal: AbortSignal, setState?: Fn): Promise<any> {
		if (!manifest.type || !['github', 'other'].includes(manifest.type))
			manifest.type = /^(https?:\/\/)(www\.)?github\.com/.test(manifest.main) ? 'github' : 'other';

		this.logger.debug(`Fetching bundle from ${manifest.main}...`);

		// If icon is an external image then download it locally and convert the uri to a file:// pointer
		// The icon is stored under Unbound/Packs/:id/unbound/icon.png
		if (typeof manifest.icon === 'object' && manifest.icon.uri) {
			const path = `${this.path}/${manifest.id}/${ClientName.toLowerCase()}/icon.png`;

			await download(manifest.icon.uri, path, 'base64', signal)
				.then(() => {
					if (typeof manifest.icon === 'object') {
						manifest.icon.uri = `file://{__path__}/${path}`;
					}
				});
		}

		const bundle = await (async () => {
			switch (manifest.type) {
				case 'github':
					return await this.installFromGithub(manifest.main, setState, manifest);
				default:
					return 'default';
			}
		})();

		this.logger.debug('Done fetching...');

		return bundle;
	}

	override save(bundle: string, manifest: Manifest) {
		fs.write(`${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2));
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			this.applyPack(addon.id);
		} catch (e) {
			this.logger.error('Failed to apply pack:', e.message);
		}

		this.emit('applied', addon);
		this.logger.log(`${addon.id} started.`);
	}

	override async enable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', this.settings.get('packs', [defaultPack])
				.find(x => x.manifest.id === addon.data.id) || defaultPack);

			if (!addon.started) {
				this.patcher.unpatchAll();
				await this.start(addon);
			}
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message);
		}
	}

	override async delete(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			if (this.applied.manifest.id === addon.data.id) {
				this.settings.set('applied', this.settings.get('packs', [defaultPack])
					.find(x => x.manifest.id === 'default') || defaultPack);
			}

			this.settings.set('packs', this.settings.get('packs', [defaultPack])
				.filter(x => x.manifest.id !== addon.data.id));

			await this.unload(addon);
			await fs.rm(`${this.path}/${addon.data.id}`);
			await this.showAddonToast(null, 'UNBOUND_SUCCESSFULLY_UNINSTALLED', 'CloseSmallIcon');
		} catch (e) {
			this.logger.error(`Failed to delete ${addon.data.id}:`, e.message ?? e);
		}
	}

	override isEnabled(id: string): boolean {
		return this.applied.manifest.id === id;
	}

	override handleBundle(bundle: string): string {
		return bundle;
	}

	async installFromGithub(url: string, setState: Fn, manifest: PackManifest) {
		const { username, repo, branch, path, tree } = await this.getAssetsFromGitRepo(url);
		const assets = tree.filter(x => x.type === 'blob');
		const chunks = chunkArray(assets, 50);

		let completed = 0;

		for (let i = 0; i < chunks.length; i++) {
			await Promise.all(chunks[i].map(async (asset) => {
				const assetUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch ?? 'main'}/${path ? `${path}/` : ''}${asset.path}`;
				const assetPath = `${this.path}/${manifest.id}/${asset.path}`;

				await download(assetUrl, assetPath, 'base64', this.signal)
					.then(() => {
						setState({
							message: Strings.UNBOUND_DOWNLOAD_PACK_PROGRESS.format({ progress: `${completed++}/${assets.length}` })
						});
					});
			}));
		}

		const installed = await fs.exists(`${this.path}/${manifest.id}`);
		installed && this.settings.set('packs', [
			...this.settings.get('packs', [defaultPack]).filter(x => x.manifest.id !== manifest.id),
			{ bundle: manifest.name, manifest }
		]);

		return manifest.name;
	}

	packExists<TAsync extends boolean>(
		pack: Pack | Addon,
		filesystem = false as TAsync
	): TAsync extends true ? Promise<boolean> : boolean {
		const id = (pack as any).data.id || (pack as any).manifest.id;

		if (filesystem) {
			return fs.exists(`${this.path}/${id}`) as any;
		}

		return this.settings.get('packs', [defaultPack])
			.map(pack => pack.manifest.id)
			.includes(id) as TAsync extends true ? Promise<boolean> : boolean;
	}

	applyPack(packId: string) {
		for (let id = 1; ; id++) {
			const asset: Asset | undefined = registry.getAssetByID(id);

			if (!asset) break;

			this.applyIconPath(packId, asset);
		}

		this.patcher.unpatchAll();
		this.applyImagePatch(packId);
	}

	getRelativeAssetPath(asset: Asset, scale: number) {
		const path = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');
		return `${path}/${asset.name}${scale > 1 ? `@${scale}x` : ''}.${asset.type}`;
	}

	async applyIconPath(id: string, asset: Asset) {
		if (id === 'default') return;

		asset.scales.sort((a, b) => b - a);

		for (const scale of asset.scales) {
			const exactPath = this.getRelativeAssetPath(asset, scale);
			const filePath = `${this.path}/${id}/${exactPath}`;

			delete asset.iconPackPath;
			delete asset.iconPackScale;

			const fileExists = await fs.exists(filePath);
			if (fileExists) {
				asset.iconPackPath = filePath;
				asset.iconPackScale = scale;
				break;
			}
		}
	}

	async applyImagePatch(id: string) {
		// @ts-expect-error - RN.Image has no 'render' method defined in its types
		this.patcher.before(Image, 'render', (_, [props]) => {
			const { source } = props;

			if (typeof source !== 'number' || id === 'default') return;

			const asset = registry.getAssetByID(source);
			if (!asset) return;

			if (asset.iconPackPath && asset.iconPackScale) {
				props.source = {
					width: asset.width,
					height: asset.height,
					uri: `file://${asset.iconPackPath}`,
					scale: asset.iconPackScale
				};
			}
		});
	}

	async findFolder(tree: any[], paths: string[]) {
		const last = paths.pop();
		let result = tree;

		for (const component of paths) {
			const path = result.find(x => x.path === component);

			result = await fetch(path.url, { signal: this.signal }).then(x => x.json()).then(x => x.tree);
		}

		return `${result.find(x => x.path === last).url}?recursive=true`;
	}

	async getAssetsFromGitRepo(url: string) {
		const regex = /https:\/\/github\.com\/([^\/]*)\/([^\/]*)(?:\/tree\/([^\/]*))?\/?(.*)?/;
		const [, username, repo, branch, path] = url.match(regex) as string[];

		const res = {
			username,
			repo,
			branch,
			path,
			tree: [] as any[]
		};

		const treesApiUrl = `https://api.github.com/repos/${username}/${repo}/git/trees/${branch ?? 'main'}?recursive=${Boolean(path)}`;
		const { tree }: { tree: any[]; } = await fetch(treesApiUrl, { signal: this.signal }).then(x => x.json());

		if (!path) {
			res.tree = tree;
			return res;
		};

		const folder = await this.findFolder(tree, path.split('/'));
		const assets = await fetch(folder, { signal: this.signal }).then(x => x.json());

		res.tree = assets.tree;
		return res;
	}
}

export default new Icons();