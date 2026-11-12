export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type Problem = {
  number: number;
  title: string;
  description?: string;
  difficulty?: Difficulty;
  link?: string;
  officialSolution?: string;
  tags: string[];
};

export type PostAuthor = { id: string; username: string };

export type PostComment = {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
};

export type Post = {
  id: string;
  author: PostAuthor;
  problem: Problem;
  description: string;
  solution: string; // LeetCode solution link
  timeComplexity: string;
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
  createdAt: string;
  updatedAt?: string;
  /** @deprecated Use problem.number and problem.title. */
  problemNumber?: number;
  /** @deprecated Use problem.title. */
  problemName?: string;
  /** @deprecated Use problem.difficulty. */
  difficulty?: Difficulty;
  /** @deprecated Use problem.tags. */
  tags?: string[];
  /** @deprecated Space complexity is not persisted on posts. */
  spaceComplexity?: string;
};

// What the create/edit form sends (the 4 fields the backend saves)
export type PostInput = {
  problemNumber: number;
  description: string;
  solutionUrl: string;
  timeComplexity: string;
};

export type FeedType = 'main' | 'following';
