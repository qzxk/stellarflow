export const validPost = {
  title: 'Test Post Title',
  content: 'This is a test post content with enough characters.',
  status: 'published',
  tags: ['test', 'sample']
};

export const draftPost = {
  title: 'Draft Post',
  content: 'This is a draft post.',
  status: 'draft'
};

export const invalidPosts = {
  missingTitle: {
    content: 'Content without title'
  },
  missingContent: {
    title: 'Title without content'
  },
  tooShortTitle: {
    title: 'Hi',
    content: 'Content is here'
  },
  tooLongTitle: {
    title: 'A'.repeat(201),
    content: 'Content is here'
  }
};

export const postFactory = (overrides = {}) => ({
  title: `Test Post ${Date.now()}`,
  content: `This is test content created at ${new Date().toISOString()}`,
  status: 'published',
  tags: ['test'],
  ...overrides
});

export const createPosts = (count, userId, overrides = {}) => {
  return Array.from({ length: count }, (_, i) => postFactory({
    title: `Test Post ${i} - ${Date.now()}`,
    userId,
    ...overrides
  }));
};