// "as const" keeps this as a fixed list of exact values, which zod's z.enum() needs.
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

// Suggestions for tag autocomplete later (optional)
export const COMMON_TAGS = [
  'Array',
  'String',
  'HashTable',
  'BFS',
  'DFS',
  'DP',
  'Graph',
  'Tree',
  'BinarySearch',
  'TwoPointers',
  'SlidingWindow',
  'Stack',
  'Heap',
  'Greedy',
  'Backtracking',
  'LinkedList',
];
