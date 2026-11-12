import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { POST_AUDIO_BUCKET } from '../post-audio/post-audio.service';
import { LeetCodeService } from '../problems/leetcode.service';
import { ProblemsService } from '../problems/problems.service';
import type { CreatePostDto, UpdatePostDto } from './dto/post-content.dto';
import { encodePostCursor, type PostPagination } from './dto/post-pagination.dto';

export interface PostRecord {
  post_id: string;
  user_id: string;
  problem_number: number;
  like_count: number | null;
  post_description: string | null;
  user_solution: string | null;
  user_time_complexity: string | null;
  user_space_complexity: string | null;
  solution_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PostAuthor {
  id: string;
  username: string | null;
  profilePicture: string | null;
}

export interface PostComment {
  id: string;
  postId: string;
  author: PostAuthor;
  text: string;
  likeCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PostResponse extends PostRecord {
  id: string;
  author: PostAuthor;
  problemNumber: number;
  problemName: string | null;
  difficulty: string | null;
  problemLink: string | null;
  description: string | null;
  tags: string[];
  timeComplexity: string | null;
  spaceComplexity: string | null;
  solutionUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PostsPage {
  posts: PostResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
    @Inject(ProblemsService) private readonly problems: ProblemsService,
    @Inject(LeetCodeService) private readonly leetcode: LeetCodeService,
  ) {}

  findAll(
    accessToken: string,
    tags: string[] = [],
    pagination?: PostPagination,
  ): Promise<PostsPage> {
    return this.findPage('post_details', accessToken, tags, pagination);
  }

  findFollowing(
    accessToken: string,
    tags: string[] = [],
    pagination?: PostPagination,
  ): Promise<PostsPage> {
    return this.findPage('following_post_details', accessToken, tags, pagination);
  }

  private async findPage(
    source: 'post_details' | 'following_post_details',
    accessToken: string,
    tags: string[],
    { cursor, limit }: PostPagination = { limit: 50 },
  ): Promise<PostsPage> {
    const client = this.supabase.forUser(accessToken);

    // PostgREST follows the problem_tags junction. The separate filter embed
    // lets us return every tag on each matching problem.
    let query = client
      .from(source)
      .select(
        tags.length > 0
          ? '*, problems!inner(tags(tag_name), matching_tags:tags!inner())'
          : '*',
      );

    if (tags.length > 0) {
      // Quote each name for PostgREST's in-list grammar, including literal quotes and backslashes.
      const tagNames = tags.map(tag => {
        const escaped = tag.replace(/["\\]/g, character => `\\${character}`);
        return `"${escaped}"`;
      });
      query = query.filter('problems.matching_tags.tag_name', 'in', `(${tagNames.join(',')})`);
    }

    if (cursor) {
      // Continue strictly after the last returned row in the same sort order.
      if (cursor.created_at === null) {
        query = query.is('created_at', null).lt('post_id', cursor.post_id);
      } else {
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},post_id.lt.${cursor.post_id}),created_at.is.null`,
        );
      }
    }

    const { data, error, status } = await query
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('post_id', { ascending: false })
      // One extra row tells us whether another page exists without a count query.
      .limit(limit + 1)
      .returns<(PostResponse & { problems?: { tags: { tag_name: string }[] } })[]>();

    if (error) {
      this.fail(status, 'Unable to fetch posts');
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit).map(({ problems, ...post }) => {
      if (!problems) return post;
      return { ...post, problems: { problem_tags: problems.tags.map(tag => tag.tag_name) } };
    });
    const lastPost = posts.at(-1);

    return {
      posts,
      nextCursor: hasMore && lastPost ? encodePostCursor(lastPost) : null,
      hasMore,
    };
  }

  async findOne(accessToken: string, id: string): Promise<PostResponse> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('post_details').select('*').eq('post_id', id).maybeSingle<PostResponse>();

    if (error) this.fail(status, 'Unable to fetch post');
    if (!data) throw new NotFoundException('Post not found');
    return data;
  }

  async create(accessToken: string, input: CreatePostDto): Promise<PostResponse> {
    const client = this.supabase.forUser(accessToken);
    const { data: auth, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !auth.user?.id) throw new UnauthorizedException('Invalid or expired access token');

    // Posts reference problems through a foreign key. Check our database first
    // and import a missing problem from LeetCode only when a slug was provided.
    const { problem_slug, ...postFields } = input;
    try {
      await this.problems.findOne(input.problem_number);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      if (!problem_slug) {
        throw new BadRequestException('Problem not found. Include problem_slug to import it from LeetCode');
      }

      const problem = await this.leetcode.fetchProblemBySlug(problem_slug);
      // Never save a different problem than the number in the user's post.
      if (problem.problem_number !== input.problem_number) {
        throw new BadRequestException('problem_slug does not match problem_number');
      }
      await this.problems.findOrCreate(problem);
    }

    // problem_slug is request-only metadata; it must not be inserted into posts.
    const { data, error, status } = await client
      .from('posts').insert({ ...postFields, user_id: auth.user.id })
      .select('*').single<PostRecord>();

    if (error?.code === '23503') throw new BadRequestException('Referenced problem does not exist');
    if (error) this.fail(status, 'Unable to create post');
    return this.findOne(accessToken, data.post_id);
  }

  async update(accessToken: string, id: string, input: UpdatePostDto): Promise<PostResponse> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').update({ ...input, updated_at: new Date().toISOString() }).eq('post_id', id)
      .select('*').maybeSingle<PostRecord>();

    if (error?.code === '23503') throw new BadRequestException('Referenced problem does not exist');
    if (error) this.fail(status, 'Unable to update post');
    if (!data) throw new NotFoundException('Post not found or not editable');
    return this.findOne(accessToken, data.post_id);
  }

  async remove(accessToken: string, id: string): Promise<void> {
    const client = this.supabase.forUser(accessToken);
    const { data, error, status } = await client
      .from('posts').delete().eq('post_id', id)
      .select('post_id, audio_path').maybeSingle<{ post_id: string; audio_path?: string | null }>();

    if (error?.code === '23503') throw new ConflictException('Post has dependent likes or comments');
    if (error) this.fail(status, 'Unable to delete post');
    if (!data) throw new NotFoundException('Post not found or not editable');

    // Delete the post's audio recording too, so the file isn't left in storage.
    // Best-effort: the post is already gone, so a failure here only leaves an unused file.
    if (data.audio_path) {
      await client.storage.from(POST_AUDIO_BUCKET).remove([data.audio_path]);
    }
  }

  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
