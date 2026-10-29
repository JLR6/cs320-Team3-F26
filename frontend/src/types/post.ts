export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface PostAuthor {
  id: string;
  username: string;
}

// TODO will this have likes and such?
export interface PostComment {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: string; // ISO string
}

export interface Post {
  id: string;
  author: PostAuthor;
  problemNumber: number;
  problemName: string;
  difficulty: Difficulty; // could be a tag
  description: string;
  tags: string[]; // stored WITHOUT the leading '#', e.g. "BFS"
  timeComplexity: string; // could be a tag
  spaceComplexity: string; // could be a tag
  solutionUrl?: string;
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
  createdAt: string;
  updatedAt?: string;
}

// What the create/edit form submits
export type PostInput = Pick<
  Post,
  | 'problemNumber'
  | 'problemName'
  | 'difficulty' // could be a tag
  | 'description'
  | 'tags'
  | 'timeComplexity' // could be a tag
  | 'spaceComplexity' // could be a tag
  | 'solutionUrl'
>;
