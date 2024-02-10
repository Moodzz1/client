import { showInstallAlert } from '@ui/components/internal/install-modal';
import { React, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/components/internal';
import { showAlert } from '@api/dialogs';
import Themes from '@managers/themes';
import { Strings } from '@api/i18n';
import { noop } from '@utilities';

function ThemesPage() {
	const addons = Themes.useEntities();

	return <RN.View style={{ flex: 1 }}>
		<Addons
			showHeaderRight={false}
			showToggles={false}
			type='themes'
			addons={addons}
		/>
	</RN.View>;
};

export const callback = ({ type, ref }) => {
	showAlert({
		title: Strings.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
		content: Strings.UNBOUND_THEME_GET_DESC,
		buttons: [
			{
				text: Strings.UNBOUND_THEME_GET_OPTION_IMPORT,
				onPress: () => showInstallAlert({ type, ref })
			},
			{
				text: Strings.UNBOUND_THEME_GET_OPTION_CREATE,
				variant: 'primary-alt',
				onPress: noop
			},
		]
	});
};

export default { page: <ThemesPage />, callback };