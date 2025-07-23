import express from 'express';
import Post from '../models/Post.js';
import { authenticate, optionalAuth, requireOwnership } from '../middleware/auth.js';
import { validate, schemas, sanitize } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

const router = express.Router();

// @route   GET /api/posts
// @desc    Get all posts with pagination and filtering
// @access  Public
router.get('/',
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, sort, order } = req.query;
    const { author_id, tags, search, status = 'published' } = req.query;
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status,
      author_id,
      tags,
      search
    };

    const posts = await Post.findAll(options);
    const totalPosts = await Post.getTotalCount(status);
    const totalPages = Math.ceil(totalPosts / limit);

    // Add comment counts to posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const commentCount = await post.getCommentCount();
        return {
          ...post,
          comment_count: commentCount
        };
      })
    );

    res.json({
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
    });
  })
);

// @route   GET /api/posts/search
// @desc    Search posts
// @access  Public
router.get('/search',
  validate(schemas.searchQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { q: query, page, limit } = req.query;
    const offset = (page - 1) * limit;

    const posts = await Post.search(query, limit, offset);
    
    res.json({
      posts,
      query,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    });
  })
);

// @route   POST /api/posts
// @desc    Create new post
// @access  Private
router.post('/',
  authenticate,
  validate(schemas.createPost),
  asyncHandler(async (req, res) => {
    const postData = {
      ...req.body,
      author_id: req.user.id,
      content: sanitize.html(req.body.content),
      excerpt: req.body.excerpt ? sanitize.text(req.body.excerpt) : null,
      tags: sanitize.tags(req.body.tags)
    };

    const post = await Post.create(postData);

    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  })
);

// @route   GET /api/posts/:id
// @desc    Get single post by ID
// @access  Public
router.get('/:id',
  optionalAuth,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Increment view count (only for non-authors)
    if (!req.user || req.user.id !== post.author_id) {
      await post.incrementViewCount();
    }

    // Get comment count
    const commentCount = await post.getCommentCount();

    res.json({
      post: {
        ...post,
        comment_count: commentCount
      }
    });
  })
);

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private (Owner or Admin)
router.put('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  requireOwnership('post'),
  validate(schemas.updatePost),
  asyncHandler(async (req, res) => {
    const updateData = {
      ...req.body,
      content: req.body.content ? sanitize.html(req.body.content) : undefined,
      excerpt: req.body.excerpt ? sanitize.text(req.body.excerpt) : undefined,
      tags: req.body.tags ? sanitize.tags(req.body.tags) : undefined
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedPost = await req.resource.update(updateData);

    res.json({
      message: 'Post updated successfully',
      post: updatedPost
    });
  })
);

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private (Owner or Admin)
router.delete('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  requireOwnership('post'),
  asyncHandler(async (req, res) => {
    await req.resource.delete();

    res.json({
      message: 'Post deleted successfully'
    });
  })
);

// @route   POST /api/posts/:id/like
// @desc    Like/unlike post
// @access  Private
router.post('/:id/like',
  authenticate,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // TODO: Implement proper like/unlike functionality with user tracking
    // For now, just increment like count
    await post.incrementLikeCount();

    res.json({
      message: 'Post liked successfully',
      like_count: post.like_count + 1
    });
  })
);

// @route   GET /api/posts/:id/comments
// @desc    Get comments for a post
// @access  Public
router.get('/:id/comments',
  validate(schemas.idParam, 'params'),
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const comments = await post.getComments(limit, offset);
    const totalComments = await post.getCommentCount();
    const totalPages = Math.ceil(totalComments / limit);

    res.json({
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
    });
  })
);

// @route   POST /api/posts/:id/comments
// @desc    Create comment on post
// @access  Private
router.post('/:id/comments',
  authenticate,
  validate(schemas.idParam, 'params'),
  validate(schemas.createComment),
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const { content, parent_id } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // If parent_id is provided, verify the parent comment exists and belongs to this post
    if (parent_id) {
      const Comment = (await import('../models/Comment.js')).default;
      const parentComment = await Comment.findById(parent_id);
      if (!parentComment || parentComment.post_id !== parseInt(postId)) {
        throw new NotFoundError('Parent comment not found or does not belong to this post');
      }
    }

    const Comment = (await import('../models/Comment.js')).default;
    const comment = await Comment.create({
      content: sanitize.text(content),
      post_id: postId,
      author_id: req.user.id,
      parent_id
    });

    res.status(201).json({
      message: 'Comment created successfully',
      comment
    });
  })
);

// @route   GET /api/posts/drafts
// @desc    Get user's draft posts
// @access  Private
router.get('/drafts',
  authenticate,
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status: 'draft',
      author_id: req.user.id
    };

    const drafts = await Post.findAll(options);
    const totalDrafts = await Post.getTotalCount('draft', req.user.id);
    const totalPages = Math.ceil(totalDrafts / limit);

    res.json({
      drafts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalDrafts,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  })
);

export default router;