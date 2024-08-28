import { getStore, useSettingsStore } from '@api/storage';
import { Onboarding, Content } from '@ui/onboarding';
import { Reanimated } from '@api/metro/common';
import { useEffect, useState } from 'react';
import { createPatcher } from '@patcher';
import { findByName } from '@api/metro';

const Patcher = createPatcher('onboarding');
const { useSharedValue, withTiming } = Reanimated;

export const data = {
	id: 'modules.onboarding',
	default: true
};

export function initialize() {
	const store = getStore('unbound');

	if (!store.get('onboarding.completed', false)) {
		store.set('onboarding.hidden', false);
		store.set('onboarding.install', false);
	} else {
		return;
	};

	const LaunchPadContainer = findByName('LaunchPadContainer', { interop: false });

	Patcher.after(LaunchPadContainer, 'default', (_, __, res) => {
		const [content, setContent] = useState({ id: '', instance: null });
		const settings = useSettingsStore('unbound');
		const contentOpacity = useSharedValue(0);
		const onboardingOpacity = useSharedValue(0);

		useEffect(() => {
			setTimeout(() => {
				contentOpacity.value = withTiming(1, { duration: 500 });
				onboardingOpacity.value = withTiming(1, { duration: 500 });
			});
		}, []);

		function onComplete() {
			contentOpacity.value = withTiming(0, { duration: 500 });
			onboardingOpacity.value = withTiming(0, { duration: 500 });
			setTimeout(() => settings.set('onboarding.completed', true), 500);
		}

		return <>
			{res}
			<Content
				instance={content.instance}
				opacity={contentOpacity}
			/>
			<Onboarding
				contentId={content.id}
				setContent={setContent}
				opacity={onboardingOpacity}
				onComplete={onComplete}
			/>
		</>;
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}