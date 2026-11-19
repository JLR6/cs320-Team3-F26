import { SearchBar } from '../../components/searchBar';

export default function SearchBarPage() {
  return (
    <SearchBar
      onFiltersChange={(filters) => console.log('Selected filters:', filters)}
    />
  );
}
