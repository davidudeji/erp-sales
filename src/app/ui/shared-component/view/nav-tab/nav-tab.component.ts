import { Component, Input, Type } from '@angular/core';
import { DropdownOption, TabConfig } from '../../service/interface/data';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-nav-tab',
  templateUrl: './nav-tab.component.html',
  styleUrl: './nav-tab.component.scss',
  // standalone: true,
  // imports: [CommonModule],
})
export class NavTabComponent {
  @Input() tabsConfig: TabConfig[] = [];
  // Stable cache key for remembering the selected tab. Prefer this over the
  // default (derived by joining tab names) — that derivation breaks silently
  // any time a tab is renamed/reordered/added, since every page that wants to
  // pre-select a tab (e.g. "go back to the Quotes tab") has to independently
  // guess the exact same joined string. Pass an explicit, stable key instead.
  @Input() cacheKey?: string;

  isDropdownOpen = false;
  selectedTab: string = '';
  selectedSetting: string | null = null;
  selectedDropdownTab: string = '';
  user_role: any = '';
  #sessionStorageCacheKey = '';

  ngOnInit(): void {
    // this.selectedTab = this.tabsConfig[0]?.name
    this.user_role = sessionStorage.getItem('role');
    this.#sessionStorageCacheKey = this.cacheKey || this.tabsConfig
      .map((tab) => tab.name)
      .join('-')
      .toLowerCase()
      .trim();
    const accessibleTab = this.tabsConfig.find(
      (tab) => !tab.role || tab.role === this.user_role
    );
    this.selectedTab = accessibleTab
      ? accessibleTab.name
      : this.tabsConfig[0]?.name;

    const cachedTabName = sessionStorage.getItem(this.#sessionStorageCacheKey);
    if (cachedTabName) {
      this.selectedTab = cachedTabName;
    }
  }

  toggleDropdown(tabName: string) {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectTab(tab: any) {
    if (tab.hasDropdown) {
      this.toggleDropdown(tab.name);
      this.selectedDropdownTab = tab.name;
    } else {
      this.selectedTab = tab.name;
      this.#cacheSelectedTab(tab.name);
      this.isDropdownOpen = false;
    }
  }

  selectDropdownOption(tabName: string, option: DropdownOption) {
    this.selectedTab = tabName;
    this.#cacheSelectedTab(tabName);
    this.selectedSetting = option.action;
    this.isDropdownOpen = false;
  }
  getComponentForOption(action: string): Type<any> | null {
    const tab = this.tabsConfig.find((t) =>
      t.dropdownOptions?.some((opt) => opt.action === action)
    );
    return (
      tab?.dropdownOptions?.find((opt) => opt.action === action)?.component ||
      null
    );
  }

  #cacheSelectedTab(tabName: string) {
    sessionStorage.setItem(this.#sessionStorageCacheKey, tabName);
  }
}
