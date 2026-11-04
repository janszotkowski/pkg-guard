import { Tabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';

export const PACKAGE_TABS = ['history', 'composition', 'exports'] as const;
export type PackageTab = (typeof PACKAGE_TABS)[number];

type PackageTabsProps = {
    tabs: readonly { value: PackageTab; label: string; content: ReactNode }[];
    value: PackageTab;
    onChange: (tab: PackageTab) => void;
};

/** One detail of a package at a time. Only the chosen one is rendered, so a tab nobody opens asks for nothing. */
export const PackageTabs = (props: PackageTabsProps) => (
    <Tabs.Root
        value={props.value}
        onValueChange={(next) => props.onChange(next as PackageTab)}
        className={'flex flex-col gap-6'}
    >
        <Tabs.List className={'flex gap-6 overflow-x-auto border-b'}>
            {props.tabs.map((tab) => (
                <Tabs.Tab
                    key={tab.value}
                    value={tab.value}
                    className={
                        '-mb-px min-h-11 cursor-pointer border-b-2 border-transparent text-callout font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:border-foreground data-active:text-foreground'
                    }
                >
                    {tab.label}
                </Tabs.Tab>
            ))}
        </Tabs.List>
        {props.tabs.map((tab) => (
            <Tabs.Panel
                key={tab.value}
                value={tab.value}
                className={'outline-none'}
            >
                {tab.content}
            </Tabs.Panel>
        ))}
    </Tabs.Root>
);
