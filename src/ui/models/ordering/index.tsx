import { TrailingIcon, resolveType } from '@ui/models/ordering/utilities';
import { ReactNative as RN } from '@metro/common';
import type { Addon, Manager } from '@typings/managers';
import { useSettingsStore } from '@api/storage';
import { Checkbox } from '@ui/components/misc';
import { Strings } from '@api/i18n';

export { TrailingIcon, resolveType };

const radioItems = [
	{
		id: 'default',
		label: 'UNBOUND_DEFAULT',
		icon: 'PencilSparkleIcon',

		ordering(addons: Addon[]) {
			return addons;
		}
	},
	{
		id: 'identifier',
		label: 'UNBOUND_IDENTIFIER',
		icon: 'feature_star',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.id.localeCompare(b.data.id));
		}
	},
	{
		id: 'name',
		label: 'UNBOUND_NAME',
		icon: 'ic_add_text',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.name.localeCompare(b.data.name));
		}
	},
	{
		id: 'description',
		label: 'UNBOUND_DESCRIPTION',
		icon: 'BookCheckIcon',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.description.localeCompare(b.data.description));
		}
	},
	{
		id: 'authors',
		label: 'UNBOUND_AUTHORS',
		icon: 'ic_group_dm',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.authors.join('').localeCompare(b.data.authors.join('')));
		}
	},
	{
		id: 'version',
		label: 'UNBOUND_VERSION',
		icon: 'ic_text_channel_16px',

		ordering(addons: Addon[]) {
			return addons.slice().sort((a, b) => {
				const versionA = a.data.version.split('.').map(Number);
				const versionB = b.data.version.split('.').map(Number);

				for (let i = 0; i < versionA.length; i++) {
					if (versionA[i] !== versionB[i]) {
						return versionA[i] - versionB[i];
					}
				}

				return 0;
			});
		}
	}
];

const sourceRadioItems = radioItems.filter(x => ['default', 'identifier', 'name', 'description'].includes(x.id));

export default (entity: Manager | Fn<Manager>, settings: ReturnType<typeof useSettingsStore>) => {
	const type = resolveType(entity);
	const items = ['source', 'fonts'].includes(type) ? sourceRadioItems : radioItems;

	console.log(type, items);

	return [
		items.map(item => {
			const { icon, label, ...rest } = item;

			const extra = {
				IconComponent: () => <TrailingIcon
					selected={settings.get(`${type}.order`, 'default') === item.id}
					source={icon}
				/>,

				action() {
					settings.set(`${type}.order`, item.id);
				},

				get label() {
					return Strings[label];
				}
			};

			return {
				...rest,
				...extra
			};
		}),
		[{
			id: 'reversed',
			label: 'Reversed',
			IconComponent: () => {
				// Requires its own independent setting store declaration or it won't re-render
				const settings = useSettingsStore('unbound');

				return <RN.TouchableOpacity
					onPress={() => settings.toggle(`${type}.reversed`, false)}
					style={{ transform: [{ scale: 0.8 }, { translateX: 2 }] }}
				>
					<Checkbox.FormCheckbox
						checked={settings.get(`${type}.reversed`, false)}
					/>
				</RN.TouchableOpacity>;
			},

			action() {
				settings.toggle(`${type}.reversed`, false);
			},

			ordering(addons: Addon[]) {
				return addons;
			}
		}]
	];
};