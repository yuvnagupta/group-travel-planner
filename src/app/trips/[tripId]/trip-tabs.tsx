"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useState } from "react";

type Tab = {
  value: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  content: React.ReactNode;
};

/**
 * The trip's Flights / Hotels / Expenses tabs. The open tab follows the URL
 * hash, so links like `/trips/:id#expenses` or `#expense-form` open the tab
 * that holds that section and scroll to it.
 */
export function TripTabs({
  tabs,
  defaultTab,
}: {
  tabs: Tab[];
  defaultTab: string;
}) {
  const [active, setActive] = useState(defaultTab);
  // A string, so server refreshes (which pass a new `tabs` array) don't re-run the effect.
  const values = tabs.map((t) => t.value).join(" ");

  useEffect(() => {
    function openHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const tab = values.split(" ").includes(id)
        ? id
        : target?.closest<HTMLElement>("[data-tab]")?.dataset.tab;
      if (!tab) return;
      setActive(tab);
      // Scroll once the panel is visible; a hidden target has no position.
      requestAnimationFrame(() => target?.scrollIntoView());
    }
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, [values]);

  return (
    <Tabs.Root
      value={active}
      onValueChange={(value: string) => {
        setActive(value);
        window.history.replaceState(null, "", `#${value}`);
      }}
      className="grid gap-6"
    >
      <Tabs.List className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            className="-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-primary aria-selected:text-foreground [&_svg]:size-4"
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {tab.count}
              </span>
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel
          key={tab.value}
          value={tab.value}
          // Keep hidden tabs mounted so search results and half-filled forms
          // survive switching tabs.
          keepMounted
          data-tab={tab.value}
          id={tab.value}
          className="scroll-mt-20 outline-none data-hidden:hidden"
        >
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
