export interface CreateCommentDto {
  post_id: string;
  comment_text: string;
}

export interface UpdateCommentDto {
  comment_text: string;
}