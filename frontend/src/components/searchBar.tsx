'use client';

// import { useState } from "react"; // (old) now also needs useEffect
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DIFFICULTIES } from '@/lib/constants'; // NEW: real difficulties
import { getTags } from '@/lib/posts/posts-api'; // NEW: real tags from the backend

// NEW: same list the post form uses, so the two can never drift apart.
// (Difficulty is stored on the problem, so it is a fixed list, not loaded.)
const availableDifficulties = [...DIFFICULTIES];

// TEMP!!! Mock time complexity options
// MUST: Replace with available values from post data when connected with backend
const availableComplexities = [
  'O(1)',
  'O(log n)',
  'O(n)',
  'O(n log n)',
  'O(n²)',
  'O(2ⁿ)',
];
type SearchBarProps = {
  onFiltersChange: (filters: {
    tags: string[];
    difficulties: string[];
    timeComplexities: string[];
    q: string;
    problemNumber?: number;
  }) => void;
};

export function SearchBar({ onFiltersChange }: SearchBarProps) {
  // Local state for testing the UI before backend integration
  const [search, setSearch] = useState('');
  const [problemNumber, setProblemNumber] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(
    [],
  );
  const [selectedComplexities, setSelectedComplexities] = useState<string[]>(
    [],
  );

  // NEW: tags loaded from the backend. null = still loading.
  // Shown with a leading "#" so the existing toggleTag logic (which strips it) keeps working.
  const [availableTags, setAvailableTags] = useState<string[] | null>(null);
  const [tagsFailed, setTagsFailed] = useState(false);

  // NEW: load every tag once when the search bar first appears
  useEffect(() => {
    let cancelled = false; // ignore a result that arrives after the bar is gone
    getTags()
      .then((names) => {
        if (!cancelled) setAvailableTags(names.map((name) => `#${name}`));
      })
      .catch(() => {
        if (!cancelled) setTagsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchingTags = (availableTags ?? []).filter((tag) =>
    tag.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );
  const initialTags = matchingTags.slice(0, 8);
  const filteredTags = showAllTags ? matchingTags : initialTags;
  const visibleTags = [
    ...selectedTags.filter((tag) => !filteredTags.includes(tag)),
    ...filteredTags,
  ];

  function notifyFilters(next: {
    tags: string[];
    difficulties: string[];
    timeComplexities: string[];
    q: string;
    problemNumber?: number;
  }) {
    onFiltersChange(next);
  }

  // Select or deselect a tag and notify the feed
  function toggleTag(tag: string) {
    const updatedTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag];

    setSelectedTags(updatedTags);
    notifyFilters({
      tags: updatedTags.map((item) => item.replace(/^#/, '').trim()),
      difficulties: selectedDifficulties,
      timeComplexities: selectedComplexities,
      q: search.trim(),
      problemNumber: problemNumber ? Number(problemNumber) : undefined,
    });
  }

  // Keep this generic handler for the mock difficulty and complexity filters
  function toggleSelection(
    value: string,
    selected: string[],
    setSelected: (values: string[]) => void,
    filter: 'difficulties' | 'timeComplexities',
  ) {
    const updated = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setSelected(updated);
    notifyFilters({
      tags: selectedTags.map((item) => item.replace(/^#/, '').trim()),
      difficulties: filter === 'difficulties' ? updated : selectedDifficulties,
      timeComplexities:
        filter === 'timeComplexities' ? updated : selectedComplexities,
      q: search.trim(),
      problemNumber: problemNumber ? Number(problemNumber) : undefined,
    });
  }

  // Clear all selected filters
  function clearFilters() {
    setSearch('');
    setProblemNumber('');
    setTagSearch('');
    setShowAllTags(false);
    setSelectedTags([]);
    setSelectedDifficulties([]);
    setSelectedComplexities([]);
    notifyFilters({
      tags: [],
      difficulties: [],
      timeComplexities: [],
      q: '',
      problemNumber: undefined,
    });
  }

  // Check whether any filters are currently selected
  const hasActiveFilters =
    search.trim() !== '' ||
    selectedTags.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedComplexities.length > 0 ||
    problemNumber.trim() !== '';

  // TEMP!: Connect search and filters to the backend GET /posts

  return (
    <Card className="w-full rounded-[8px] border-0 bg-card p-0 shadow-[0px_0px_8px_0px_#0000001A]">
      {/* Title */}
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
        <h2 className="text-[15px] font-bold leading-4.5 text-card-foreground">
          Search Posts
        </h2>

        {/* Clear all selected filters */}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4">
        {/* Actual search bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <Input
            value={search}
            onChange={(event) => {
              const q = event.target.value.trim();
              setSearch(event.target.value);
              notifyFilters({
                tags: selectedTags.map((item) => item.replace(/^#/, '').trim()),
                difficulties: selectedDifficulties,
                timeComplexities: selectedComplexities,
                q,
                problemNumber: problemNumber
                  ? Number(problemNumber)
                  : undefined,
              });
            }}
            placeholder="Search post descriptions..."
            className="h-8 rounded-[6px] border-0 bg-muted pl-8 text-[12px] leading-4 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="problem-number-filter"
            className="mb-2 block text-[12px] font-bold text-foreground"
          >
            Problem Number (Optional)
          </label>
          <Input
            id="problem-number-filter"
            type="number"
            min={1}
            max={2147483647}
            step={1}
            value={problemNumber}
            onChange={(event) => {
              const value = event.target.value;
              setProblemNumber(value);
              const parsed = Number(value);
              notifyFilters({
                tags: selectedTags.map((item) => item.replace(/^#/, '').trim()),
                difficulties: selectedDifficulties,
                timeComplexities: selectedComplexities,
                q: search.trim(),
                problemNumber:
                  value && Number.isInteger(parsed) && parsed > 0
                    ? parsed
                    : undefined,
              });
            }}
            placeholder="e.g. 1"
            className="h-8 rounded-[6px] border-0 bg-muted text-[12px] text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Filter sections */}
        <div className="mt-4 space-y-4">
          {/* Problem Tags */}
          <section>
            <h3 className="mb-2 text-[12px] font-bold text-foreground">
              Problem Tags
            </h3>

            {/* NEW: loading and error messages for the tag list */}
            {availableTags === null && !tagsFailed && (
              <p className="text-[11px] text-muted-foreground">
                Loading tags...
              </p>
            )}
            {tagsFailed && (
              <p className="text-[11px] text-muted-foreground">
                Couldn&apos;t load tags.
              </p>
            )}

            <Input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder="Search tags..."
              aria-label="Search tags"
              className="mb-2 h-8 rounded-[6px] border-0 bg-muted text-[12px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);

                return (
                  <Button
                    key={tag}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={`h-6 min-h-0 rounded-xl px-2.5 py-1 text-[11px] font-bold leading-none shadow-none ${
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
            {availableTags && availableTags.length > 8 && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAllTags}
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                  {showAllTags ? 'Show fewer tags' : 'Show all tags'}
                </Button>
              </div>
            )}
          </section>

          {/* Difficulty */}
          <section>
            <h3 className="mb-2 text-[12px] font-bold text-foreground">
              Difficulty
            </h3>

            <div className="flex flex-wrap gap-2">
              {availableDifficulties.map((difficulty) => {
                const isSelected = selectedDifficulties.includes(difficulty);

                return (
                  <Button
                    key={difficulty}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      toggleSelection(
                        difficulty,
                        selectedDifficulties,
                        setSelectedDifficulties,
                        'difficulties',
                      )
                    }
                    aria-pressed={isSelected}
                    className={`h-6 min-h-0 rounded-xl px-2.5 py-1 text-[11px] font-bold leading-none shadow-none ${
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {difficulty}
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Time Complexity */}
          <section>
            <h3 className="mb-2 text-[12px] font-bold text-foreground">
              Time Complexity
            </h3>

            <div className="flex flex-wrap gap-2">
              {availableComplexities.map((complexity) => {
                const isSelected = selectedComplexities.includes(complexity);

                return (
                  <Button
                    key={complexity}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      toggleSelection(
                        complexity,
                        selectedComplexities,
                        setSelectedComplexities,
                        'timeComplexities',
                      )
                    }
                    aria-pressed={isSelected}
                    className={`h-6 min-h-0 rounded-xl px-2.5 py-1 text-[11px] font-bold leading-none shadow-none ${
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {complexity}
                  </Button>
                );
              })}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
