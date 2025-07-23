import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../middleware/errorHandler.js';
import { sanitize } from '../middleware/validation.js';

class PostService {
  // Create new post
  static async createPost(postData, authorId) {
    const sanitizedData = {
      ...postData,
      author_id: authorId,
      content: sanitize.html(postData.content),
      excerpt: postData.excerpt ? sanitize.text(postData.excerpt) : null,
      tags: sanitize.tags(postData.tags)
    };

    const post = await Post.create(sanitizedData);
    return post;
  }

  // Get posts with filtering and pagination
  static async getPosts(options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      status = 'published',
      author_id,
      tags,
      search
    } = options;

    const offset = (page - 1) * limit;

    const queryOptions = {
      limit,
      offset,
      status,
      author_id,
      tags,
      search,
      sort,
      order
    };

    const posts = await Post.findAll(queryOptions);
    const totalPosts = await Post.getTotalCount(status, author_id);
    const totalPages = Math.ceil(totalPosts / limit);

    // Add comment counts to posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const commentCount = await post.getCommentCount();
        return {
          ...post.toJSON(),
          comment_count: commentCount
        };
      })
    );

    return {
      posts: postsWithCounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalPosts,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        status,
        author_id,
        tags,
        search
      }
    };
  }

  // Get single post by ID
  static async getPostById(id, userId = null) {
    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Increment view count (only for non-authors)
    if (!userId || userId !== post.author_id) {
      await post.incrementViewCount();
    }

    // Get comment count
    const commentCount = await post.getCommentCount();

    return {
      ...post.toJSON(),
      comment_count: commentCount
    };
  }

  // Update post
  static async updatePost(postId, updateData, userId, isAdmin = false) {
    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Check ownership
    if (post.author_id !== userId && !isAdmin) {
      throw new ForbiddenError('You can only update your own posts');
    }

    const sanitizedData = {
      ...updateData,
      content: updateData.content ? sanitize.html(updateData.content) : undefined,
      excerpt: updateData.excerpt ? sanitize.text(updateData.excerpt) : undefined,
      tags: updateData.tags ? sanitize.tags(updateData.tags) : undefined
    };

    // Remove undefined values
    Object.keys(sanitizedData).forEach(key => {
      if (sanitizedData[key] === undefined) {
        delete sanitizedData[key];
      }
    });

    const updatedPost = await post.update(sanitizedData);
    return updatedPost;
  }

  // Delete post
  static async deletePost(postId, userId, isAdmin = false) {
    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Check ownership
    if (post.author_id !== userId && !isAdmin) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    await post.delete();
    return { message: 'Post deleted successfully' };
  }

  // Search posts
  static async searchPosts(query, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const posts = await Post.search(query, limit, offset);

    return {
      posts: posts.map(post => post.toJSON()),
      query,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    };
  }

  // Like post (simplified - in real app would track user likes)
  static async likePost(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // TODO: Implement proper like/unlike functionality with user tracking
    // For now, just increment like count
    await post.incrementLikeCount();

    return {
      message: 'Post liked successfully',
      like_count: post.like_count + 1
    };
  }

  // Get user's draft posts
  static async getDrafts(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status: 'draft',
      author_id: userId
    };

    const drafts = await Post.findAll(options);
    const totalDrafts = await Post.getTotalCount('draft', userId);
    const totalPages = Math.ceil(totalDrafts / limit);

    return {
      drafts: drafts.map(draft => draft.toJSON()),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalDrafts,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Get post comments
  static async getPostComments(postId, page = 1, limit = 20) {
    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const offset = (page - 1) * limit;
    const comments = await post.getComments(limit, offset);
    const totalComments = await post.getCommentCount();
    const totalPages = Math.ceil(totalComments / limit);

    return {
      comments,
      post: {
        id: post.id,
        title: post.title
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalComments,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Create comment on post
  static async createComment(postId, commentData, userId) {
    const { content, parent_id } = commentData;

    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // If parent_id is provided, verify the parent comment exists and belongs to this post
    if (parent_id) {
      const parentComment = await Comment.findById(parent_id);
      if (!parentComment || parentComment.post_id !== parseInt(postId)) {
        throw new NotFoundError('Parent comment not found or does not belong to this post');
      }
    }

    const comment = await Comment.create({
      content: sanitize.text(content),
      post_id: postId,
      author_id: userId,
      parent_id
    });

    return comment;
  }

  // Get posts by status for admin/moderation
  static async getPostsByStatus(status, page = 1, limit = 20, isAdmin = false) {
    if (!isAdmin) {
      throw new UnauthorizedError('Admin access required');
    }

    const offset = (page - 1) * limit;
    const options = {
      limit,
      offset,
      status
    };

    const posts = await Post.findAll(options);
    const totalPosts = await Post.getTotalCount(status);
    const totalPages = Math.ceil(totalPosts / limit);

    return {
      posts: posts.map(post => post.toJSON()),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalPosts,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      status
    };
  }

  // Get popular posts (by views or likes)
  static async getPopularPosts(type = 'views', page = 1, limit = 20) {
    const sortField = type === 'likes' ? 'like_count' : 'view_count';
    
    const options = {
      page,
      limit,
      sort: sortField,
      order: 'desc',
      status: 'published'
    };

    return await this.getPosts(options);
  }

  // Get recent posts
  static async getRecentPosts(page = 1, limit = 20) {
    const options = {
      page,
      limit,
      sort: 'created_at',
      order: 'desc',
      status: 'published'
    };

    return await this.getPosts(options);
  }

  // Get posts by tag
  static async getPostsByTag(tag, page = 1, limit = 20) {
    const options = {
      page,
      limit,
      tags: tag,
      status: 'published'
    };

    return await this.getPosts(options);
  }

  // Get featured posts (posts with featured_image)
  static async getFeaturedPosts(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    // Custom query for posts with featured images
    const options = {
      limit,
      offset,
      status: 'published'
    };

    const posts = await Post.findAll(options);
    const featuredPosts = posts.filter(post => post.featured_image);
    
    return {
      posts: featuredPosts.map(post => post.toJSON()),
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    };
  }
}

export default PostService;