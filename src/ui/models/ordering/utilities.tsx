import { StyleSheet, ReactNative as RN } from '@metro/common';
import type { Manager } from '@typings/managers';
import { TintedIcon } from '@ui/components/misc';
import { getIDByName } from '@api/assets';
import * as managers from '@managers';

export const resolveType = (entity: Manager | Fn<Manager>) => {
	const resolved = typeof entity === 'function' ? entity() : entity;
	const manager = managers[resolved];
	if (!manager || !manager.type) return;

	return manager.type;
};

const useStyles = StyleSheet.createStyles({
	trailing: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center'
	}
});

export const TrailingIcon = ({ selected, source }: { selected: boolean; source: string; }) => {
	const styles = useStyles();

	return <RN.View style={styles.trailing}>
		{selected && <TintedIcon
			source={getIDByName('CheckmarkLargeIcon')}
			size={14}
			style={{ height: 14 }}
		/>}
		<TintedIcon
			source={getIDByName(source)}
			size={20}
			style={{ height: 20, marginLeft: 6 }}
		/>
	</RN.View>;
};