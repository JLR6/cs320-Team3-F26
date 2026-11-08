// Post types used by the UI and posts-api.ts.
// Optional fields are not stored by the backend yet (see the TODOs in posts-api.ts).
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

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
  problemNumber: number;
  description: string;
  solution: string; // LeetCode solution link
  timeComplexity: string;
  tags: string[];
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
  createdAt: string;
  updatedAt?: string;
  problemName?: string; // not stored yet
  difficulty?: Difficulty; // not stored yet
  spaceComplexity?: string; // not stored yet
};

// What the create/edit form sends (the 4 fields the backend saves)
export type PostInput = {
  problemNumber: number;
  description: string;
  solutionUrl: string;
  timeComplexity: string;
};

export type FeedType = 'main' | 'following';
