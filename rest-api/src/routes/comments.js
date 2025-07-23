import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import { authenticate, requireAdmin, requireOwnership } from '../middleware/auth.js';
import { validate, schemas, sanitize } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

const router = express.Router();

// @route   GET /api/comments
// @desc    Get all comments (admin only)
// @access  Private/Admin
router.get('/',
  authenticate,
  requireAdmin,
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const { post_id, author_id, approved } = req.query;
    const offset = (page - 1) * limit;

    let comments;
    if (post_id) {
      comments = await Comment.findByPostId(post_id, limit, offset);
    } else if (author_id) {
      comments = await Comment.findByUserId(author_id, limit, offset);
    } else {
      // Get all comments (implement this method if needed)
      comments = await Comment.findAll(limit, offset, approved);
    }

    res.json({
      comments,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      },
      filters: {
        post_id,
        author_id,
        approved
      }
    });
  })
);

// @route   GET /api/comments/pending
// @desc    Get pending comments for moderation
// @access  Private/Admin
router.get('/pending',
  authenticate,
  requireAdmin,
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const pendingComments = await Comment.getPendingComments(limit, offset);

    res.json({
      comments: pendingComments,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    });
  })
);

// @route   GET /api/comments/:id
// @desc    Get single comment by ID
// @access  Public
router.get('/:id',
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Get replies to this comment
    const replies = await comment.getReplies();

    res.json({
      comment: {
        ...comment,
        replies
      }
    });
  })
);

// @route   PUT /api/comments/:id
// @desc    Update comment
// @access  Private (Owner or Admin)
router.put('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  requireOwnership('comment'),
  validate(schemas.updateComment),
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    
    const updatedComment = await req.resource.update({
      content: sanitize.text(content)
    });

    res.json({
      message: 'Comment updated successfully',
      comment: updatedComment
    });
  })
);

// @route   DELETE /api/comments/:id
// @desc    Delete comment (and all replies)
// @access  Private (Owner or Admin)
router.delete('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  requireOwnership('comment'),
  asyncHandler(async (req, res) => {
    await req.resource.delete();

    res.json({
      message: 'Comment deleted successfully'
    });
  })
);

// @route   POST /api/comments/:id/approve
// @desc    Approve comment
// @access  Private/Admin
router.post('/:id/approve',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await comment.approve();

    res.json({
      message: 'Comment approved successfully'
    });
  })
);

// @route   POST /api/comments/:id/reject
// @desc    Reject comment
// @access  Private/Admin
router.post('/:id/reject',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await comment.reject();

    res.json({
      message: 'Comment rejected successfully'
    });
  })
);

// @route   GET /api/comments/:id/replies
// @desc    Get replies to a comment
// @access  Public
router.get('/:id/replies',
  validate(schemas.idParam, 'params'),
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    const replies = await comment.getReplies(limit, offset);

    res.json({
      replies,
      parent_comment: {
        id: comment.id,
        content: comment.content
      },
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    });
  })
);

// @route   POST /api/comments/:id/reply
// @desc    Reply to a comment
// @access  Private
router.post('/:id/reply',
  authenticate,
  validate(schemas.idParam, 'params'),
  validate(schemas.createComment),
  asyncHandler(async (req, res) => {
    const parentCommentId = req.params.id;
    const { content } = req.body;

    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      throw new NotFoundError('Parent comment not found');
    }

    // Verify the post still exists
    const post = await Post.findById(parentComment.post_id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const reply = await Comment.create({
      content: sanitize.text(content),
      post_id: parentComment.post_id,
      author_id: req.user.id,
      parent_id: parentCommentId
    });

    res.status(201).json({
      message: 'Reply created successfully',
      comment: reply
    });
  })
);

// @route   GET /api/comments/user/:userId
// @desc    Get comments by user ID
// @access  Public
router.get('/user/:userId',
  validate(schemas.idParam, 'params'),
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const comments = await Comment.findByUserId(userId, limit, offset);

    res.json({
      comments,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    });
  })
);

export default router;