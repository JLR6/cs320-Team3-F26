
"use client";

import { useState } from "react";

// TEMP!!! Example tags for the UI skeleton
// MUST: Replace with real tags when connect w/ backend
const availableTags = [
  "#DFS",
  "#Binary Tree",
  "#Binary Search",
  "#Pandas",
  "#Time Complexity: O(n log n)",
  "#Javascript",
  "#Python",
  "#Difficulty: Medium",
  "#Google",
  "#Amazon",
  "#Database",
  "#Stack",
  "#Greedy",
  "#36. Valid Sudoku",
  "#42. Trapping Rain Water",
];

export default function SearchBar() {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Filter tags based on what the user types
 const filteredTags = availableTags.filter((tag) => {
  const searchTerms = search.toLowerCase().trim().split(/\s+/);
  return (
    selectedTags.includes(tag) ||
    searchTerms.some((term) => tag.toLowerCase().includes(term))
  );
});

  // Select or deselect a tag when clicking
  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((item) => item !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  // TEMP!: Connect to backend GET /posts

  return (
    // Search Box
    <div className="h-90 w-67.25 rounded-[8px] bg-white p-4 shadow-[0px_0px_8px_0px_#0000001A]">
      
    {/* Title */}
      <h2 className="text-[15px] font-bold leading-4.5 text-black">
        Search Tags
      </h2>

      {/* Actual search bar */}
      <div className="mt-2.25 flex h-8 w-full items-center gap-2.5 rounded-[6px] bg-[#F2F3F4] px-3.25">
        {/* Search icon inside search bar */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4B5563"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
          
        {/* Search input default text inside search bar*/}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search for a tag..."
          className="min-w-0 flex-1 bg-transparent text-[14px] leading-4.25 text-black outline-none placeholder:text-[#BBBCBF]"
        />
      </div>

      {/* Tags */}
      <div className="mt-4 flex max-h-64.5 flex-wrap content-start gap-2 overflow-y-auto">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);

          return (
            // Clickable tags
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={isSelected}
              className={`h-5.75 shrink-0 rounded-xl px-2.5 text-[12px] font-bold leading-none ${
                isSelected
                  ? "bg-[#FFA115] text-black"
                  : "bg-[#F2F3F4] text-[#59595A]"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
