import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Fuse from 'fuse.js';

// Interface for a product with optional branch info (for global results)
interface SearchProduct {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  price?: string;
  sellingPrice?: string;
  productCategory?: { name: string }; 
  branchName?: string;
  branch?: { id: number; name: string };
  branchId?: number;
  address?: string;
  imageUrl?: string; // Added for global search results
}

@Component({
  selector: 'app-searchbar',
  templateUrl: './searchbar.component.html',
  styleUrls: ['./searchbar.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule], 
})
export class SearchbarComponent implements OnChanges {
  // Input: List of products to search through
  @Input() listToSearch: SearchProduct[] = [];
  
  // Input: The current list being displayed (will be updated with search results)
  @Input() listToUpdate: SearchProduct[] = []; 
  
  // Output: Emits when the list to update changes
  @Output() listToUpdateChange = new EventEmitter<SearchProduct[]>();

  // Current search query
  currentSearchQuery = ''; 
  
  // Output: Emits when global search is triggered
  @Output() globalSearch = new EventEmitter<string>();

  // Output for when a product is selected from global search
  @Output() productSelected = new EventEmitter<any>();
  
  // Output for when a category is selected
  @Output() categorySelected = new EventEmitter<string>();
  
  /** Dropdown & state management */
  isDropdownOpen = false;
  
  // State for global search results (from parent)
  @Input() globalSearchResults: any[] = []; 
  @Input() isSearching: boolean = false;   
  @Input() searchError: string | null = null;
  
  // Passed down from parent to display in the dropdown logic
  @Input() globalSearchQuery: string = '';

  // Tracks if the user has clicked the icon to trigger a global search
  hasGlobalSearchBeenTriggered = false; 

  // Local state for suggestion display
  localSearchResults: SearchProduct[] = []; 
  noLocalResults = false; 
  
  // Category suggestions
  categorySuggestions: string[] = [];
  showCategorySuggestions = false;
  
  private fuse: Fuse<SearchProduct>;
  private readonly MIN_GLOBAL_SEARCH_LENGTH = 3;

  constructor() {
    this.fuse = new Fuse([], {
      keys: [
        { name: 'sku', weight: 2 },
        { name: 'name', weight: 1.5 },
        { name: 'productCategory.name', weight: 1 },
      ],
      includeScore: true,
      threshold: 0.3, 
    });
  }

  ngOnChanges() {
    this.fuse.setCollection(this.listToSearch);
    
    // If search is active and results arrive, open the dropdown
    if (this.currentSearchQuery.trim() && (this.isSearching || this.hasGlobalSearchBeenTriggered)) {
        this.isDropdownOpen = true; 
    }
    
    // Re-filter local suggestions if the list changes while typing
    if (this.currentSearchQuery.trim()) {
        this.searchProducts(this.currentSearchQuery, true);
    }
  }

  searchProducts(searchValue: string, isNgOnChangesTriggered = false) {
    this.currentSearchQuery = searchValue;
    const trimmedValue = searchValue.trim();
    
    // 1. Reset everything on empty search
    if (!trimmedValue) {
      this.resetList();
      this.localSearchResults = [];
      this.noLocalResults = false;
      this.isDropdownOpen = false;
      this.hasGlobalSearchBeenTriggered = false; 
      this.globalSearchResults = []; 
      this.categorySuggestions = [];
      this.showCategorySuggestions = false;
      return;
    }

    // 2. Generate category suggestions based on search
    this.generateCategorySuggestions(trimmedValue);
    
    // 3. Local Search Logic
    let searchResults: SearchProduct[] = [];

    if (trimmedValue.length <= 7) {
      searchResults = this.listToSearch.filter(p => 
        p.name.toLowerCase().startsWith(trimmedValue.toLowerCase()) || 
        p.sku.startsWith(trimmedValue)
      );
    } else {
      const fuseResults = this.fuse.search(trimmedValue);
      searchResults = fuseResults.map((val) => val.item);
    }
    
    // 4. Update the main product list (the grid) and dropdown suggestions
    if (searchResults.length === 0) {
      this.listToUpdate = [];
    } else {
      this.listToUpdate = searchResults;
    }
    this.listToUpdateChange.emit(this.listToUpdate);
    
    // Update local suggestions for the dropdown
    this.localSearchResults = searchResults.slice(0, 5);
    this.noLocalResults = searchResults.length === 0;

    // 5. Clear global results when typing new query (unless triggered by ngOnChanges)
    if (!isNgOnChangesTriggered) {
        this.hasGlobalSearchBeenTriggered = false;
        this.globalSearchResults = []; 
    }

    // 6. Handle dropdown visibility
    if (this.noLocalResults && !this.hasGlobalSearchBeenTriggered) {
        this.isDropdownOpen = true;
    } else if (this.hasGlobalSearchBeenTriggered) {
        this.isDropdownOpen = true;
    } else if (this.showCategorySuggestions) {
        this.isDropdownOpen = true;
    } else {
        this.isDropdownOpen = false;
    }
  }
  
  /** Generate category suggestions based on search query */
  private generateCategorySuggestions(searchQuery: string) {
    const query = searchQuery.toLowerCase();
    const allCategories = new Set<string>();
    
    // Extract all unique categories from products
    this.listToSearch.forEach(product => {
      if (product.productCategory?.name) {
        allCategories.add(product.productCategory.name);
      }
    });
    
    // Filter categories that match the search query
    const matchedCategories = Array.from(allCategories).filter(category => 
      category.toLowerCase().includes(query)
    );
    
    this.categorySuggestions = matchedCategories.slice(0, 5);
    this.showCategorySuggestions = this.categorySuggestions.length > 0;
  }
  
  /** Handle category selection */
  selectCategory(category: string) {
    this.categorySelected.emit(category);
    this.isDropdownOpen = false;
    this.currentSearchQuery = category;
    this.showCategorySuggestions = false;
    
    // Filter products by selected category
    const categoryProducts = this.listToSearch.filter(product => 
      product.productCategory?.name === category
    );
    
    this.listToUpdate = categoryProducts;
    this.listToUpdateChange.emit(this.listToUpdate);
  }
  
  /** Handle search icon click to trigger global search */
  onGlobalSearchClick() {
    const trimmedValue = this.currentSearchQuery.trim();
    
    if (!trimmedValue) {
      this.isDropdownOpen = !this.isDropdownOpen;
      this.hasGlobalSearchBeenTriggered = false; 
      return;
    }
    
    if (trimmedValue.length < this.MIN_GLOBAL_SEARCH_LENGTH) {
        this.hasGlobalSearchBeenTriggered = true;
        this.isDropdownOpen = true;
        this.globalSearchResults = [];
        return;
    }

    this.hasGlobalSearchBeenTriggered = true;
    this.isDropdownOpen = true;
    this.globalSearch.emit(trimmedValue);
  }

  /** Handle product selection from global search */
  selectGlobalProduct(product: any) {
    console.log('Product selected from global search:', product);
    this.productSelected.emit(product);
    this.isDropdownOpen = false;
    this.currentSearchQuery = '';
    this.hasGlobalSearchBeenTriggered = false;
    this.globalSearchResults = [];
    this.localSearchResults = [];
    this.resetList();
  }

  /** Handle image loading errors */
  onImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';
    const fallbackElement = imgElement.nextElementSibling as HTMLElement;
    if (fallbackElement) {
      fallbackElement.classList.remove('hidden');
    }
  }

  /** Clear the text and reset local/global search */
  clearSearchText(searchInput: HTMLInputElement) {
    searchInput.value = '';
    this.currentSearchQuery = '';
    this.isDropdownOpen = false;
    this.localSearchResults = []; 
    this.noLocalResults = false;  
    this.hasGlobalSearchBeenTriggered = false; 
    this.globalSearchResults = []; 
    this.categorySuggestions = [];
    this.showCategorySuggestions = false;
    this.globalSearch.emit('');
    this.resetList();
  }

  /** Reset the product grid to show all products */
  private resetList() {
    this.listToUpdate = this.listToSearch;
    this.listToUpdateChange.emit(this.listToUpdate);
  }

  // Helper for stock color
  getStockColor(quantity: number): string {
    if (quantity > 10) return 'text-green-600';
    if (quantity > 0) return 'text-orange-500';
    return 'text-red-600';
  }
  
  // Helper to close dropdown
  closeDropdown() {
    if (!this.isSearching && !this.noLocalResults && !this.showCategorySuggestions) {
        setTimeout(() => {
            this.isDropdownOpen = false;
        }, 150); 
    }
  }

  // Filter global search results to only show in-stock items
  get inStockGlobalResults(): any[] {
    return this.globalSearchResults.filter(result => result.quantity > 0);
  }
}
