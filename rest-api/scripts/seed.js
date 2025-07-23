#!/usr/bin/env node

import { Database } from '../src/config/database.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import Post from '../src/models/Post.js';
import Comment from '../src/models/Comment.js';
import bcrypt from 'bcryptjs';

class Seeder {
  constructor() {
    this.users = [];
    this.categories = [];
    this.posts = [];
  }

  async initialize() {
    try {
      await Database.initialize();
      console.log('Seeder initialized');
    } catch (error) {
      console.error('Failed to initialize seeder:', error);
      throw error;
    }
  }

  async seedUsers() {
    console.log('🌱 Seeding users...');
    
    const userData = [
      {
        username: 'admin',
        email: 'admin@stellarflow.dev',
        password: 'Admin123!',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        bio: 'System administrator and content manager.',
        email_verified: true
      },
      {
        username: 'jane_writer',
        email: 'jane@stellarflow.dev',
        password: 'Writer123!',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'author',
        bio: 'Technical writer and developer advocate. Passionate about making complex topics accessible.',
        email_verified: true
      },
      {
        username: 'mike_dev',
        email: 'mike@stellarflow.dev',
        password: 'Dev123!',
        first_name: 'Mike',
        last_name: 'Johnson',
        role: 'author',
        bio: 'Full-stack developer with 10+ years of experience in web technologies.',
        email_verified: true
      },
      {
        username: 'sarah_designer',
        email: 'sarah@stellarflow.dev',
        password: 'Design123!',
        first_name: 'Sarah',
        last_name: 'Davis',
        role: 'author',
        bio: 'UX/UI designer focused on creating intuitive and beautiful user experiences.',
        email_verified: true
      },
      {
        username: 'alex_reader',
        email: 'alex@stellarflow.dev',
        password: 'Reader123!',
        first_name: 'Alex',
        last_name: 'Wilson',
        role: 'user',
        bio: 'Technology enthusiast and avid reader of development blogs.',
        email_verified: true
      }
    ];

    for (const data of userData) {
      try {
        const existingUser = await User.findByEmail(data.email);
        if (!existingUser) {
          const user = await User.create(data);
          this.users.push(user);
          console.log(`✅ Created user: ${user.username}`);
        } else {
          this.users.push(existingUser);
          console.log(`⏭️  User already exists: ${existingUser.username}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create user ${data.username}:`, error.message);
      }
    }
  }

  async seedCategories() {
    console.log('🌱 Seeding categories...');
    
    const categoryData = [
      {
        name: 'Technology',
        slug: 'technology',
        description: 'Latest trends and developments in technology',
        color: '#3B82F6'
      },
      {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Frontend, backend, and full-stack development topics',
        color: '#10B981',
        parent_name: 'Technology'
      },
      {
        name: 'Mobile Development',
        slug: 'mobile-development',
        description: 'iOS, Android, and cross-platform mobile development',
        color: '#8B5CF6',
        parent_name: 'Technology'
      },
      {
        name: 'DevOps',
        slug: 'devops',
        description: 'Deployment, CI/CD, infrastructure, and operations',
        color: '#F59E0B',
        parent_name: 'Technology'
      },
      {
        name: 'Design',
        slug: 'design',
        description: 'UI/UX design, visual design, and user experience',
        color: '#EF4444'
      },
      {
        name: 'UI Design',
        slug: 'ui-design',
        description: 'User interface design principles and practices',
        color: '#EC4899',
        parent_name: 'Design'
      },
      {
        name: 'UX Research',
        slug: 'ux-research',
        description: 'User experience research methods and insights',
        color: '#06B6D4',
        parent_name: 'Design'
      },
      {
        name: 'Career',
        slug: 'career',
        description: 'Career advice, job hunting, and professional development',
        color: '#84CC16'
      },
      {
        name: 'Tutorials',
        slug: 'tutorials',
        description: 'Step-by-step guides and how-to articles',
        color: '#6366F1'
      },
      {
        name: 'News',
        slug: 'news',
        description: 'Industry news and updates',
        color: '#64748B'
      }
    ];

    // Create categories without parents first
    const rootCategories = categoryData.filter(cat => !cat.parent_name);
    for (const data of rootCategories) {
      try {
        const existingCategory = await Category.findBySlug(data.slug);
        if (!existingCategory) {
          const category = await Category.create(data);
          this.categories.push(category);
          console.log(`✅ Created category: ${category.name}`);
        } else {
          this.categories.push(existingCategory);
          console.log(`⏭️  Category already exists: ${existingCategory.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create category ${data.name}:`, error.message);
      }
    }

    // Create child categories
    const childCategories = categoryData.filter(cat => cat.parent_name);
    for (const data of childCategories) {
      try {
        const existingCategory = await Category.findBySlug(data.slug);
        if (!existingCategory) {
          const parent = this.categories.find(cat => cat.name === data.parent_name);
          if (parent) {
            const categoryData = { ...data, parent_id: parent.id };
            delete categoryData.parent_name;
            const category = await Category.create(categoryData);
            this.categories.push(category);
            console.log(`✅ Created child category: ${category.name}`);
          }
        } else {
          this.categories.push(existingCategory);
          console.log(`⏭️  Category already exists: ${existingCategory.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create category ${data.name}:`, error.message);
      }
    }
  }

  async seedPosts() {
    console.log('🌱 Seeding posts...');
    
    const postData = [
      {
        title: 'Getting Started with Modern Web Development',
        slug: 'getting-started-modern-web-development',
        content: `# Getting Started with Modern Web Development

Modern web development has evolved significantly over the past few years. In this comprehensive guide, we'll explore the essential tools, frameworks, and best practices that every developer should know in 2024.

## Key Technologies

### Frontend Development
- **React** - A powerful library for building user interfaces
- **Vue.js** - Progressive framework for building UIs
- **TypeScript** - Adds static typing to JavaScript
- **Tailwind CSS** - Utility-first CSS framework

### Backend Development
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** - Fast, minimalist web framework
- **GraphQL** - Query language for APIs
- **PostgreSQL** - Robust relational database

## Best Practices

1. **Code Organization** - Structure your project with clear separation of concerns
2. **Testing** - Write comprehensive unit and integration tests
3. **Performance** - Optimize for loading speed and user experience
4. **Security** - Implement proper authentication and data validation

## Conclusion

The web development landscape is constantly changing, but mastering these fundamentals will provide a solid foundation for your journey as a developer.`,
        excerpt: 'Explore the essential tools, frameworks, and best practices for modern web development in 2024.',
        author_username: 'jane_writer',
        category_slug: 'web-development',
        status: 'published',
        tags: 'web development,beginner,guide,2024',
        meta_title: 'Modern Web Development Guide 2024',
        meta_description: 'Complete guide to modern web development tools and best practices',
        reading_time: 8,
        is_featured: true
      },
      {
        title: 'Advanced React Patterns and Performance Optimization',
        slug: 'advanced-react-patterns-performance',
        content: `# Advanced React Patterns and Performance Optimization

As React applications grow in complexity, it's crucial to understand advanced patterns and optimization techniques that can help maintain performance and code quality.

## Advanced Patterns

### 1. Compound Components
This pattern allows you to create flexible and reusable components that work together.

\`\`\`jsx
const Modal = ({ children }) => {
  return <div className="modal">{children}</div>;
};

Modal.Header = ({ children }) => <header>{children}</header>;
Modal.Body = ({ children }) => <main>{children}</main>;
Modal.Footer = ({ children }) => <footer>{children}</footer>;
\`\`\`

### 2. Render Props
A technique for sharing code between components using a prop whose value is a function.

\`\`\`jsx
const DataFetcher = ({ render }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);
  
  return render({ data, loading });
};
\`\`\`

## Performance Optimization

### React.memo and useMemo
Use these to prevent unnecessary re-renders:

\`\`\`jsx
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveProcessing(item));
  }, [data]);
  
  return <div>{processedData}</div>;
});
\`\`\`

### Code Splitting
Implement lazy loading for better performance:

\`\`\`jsx
const LazyComponent = React.lazy(() => import('./LazyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
}
\`\`\`

## Conclusion

Mastering these advanced patterns and optimization techniques will help you build more maintainable and performant React applications.`,
        excerpt: 'Learn advanced React patterns and optimization techniques for building scalable applications.',
        author_username: 'mike_dev',
        category_slug: 'web-development',
        status: 'published',
        tags: 'react,performance,advanced,patterns',
        meta_title: 'Advanced React Patterns & Performance',
        meta_description: 'Master advanced React patterns and performance optimization techniques',
        reading_time: 12,
        is_featured: true
      },
      {
        title: 'The Art of UI Design: Creating Intuitive User Interfaces',
        slug: 'art-ui-design-intuitive-interfaces',
        content: `# The Art of UI Design: Creating Intuitive User Interfaces

Great user interface design is both an art and a science. It requires understanding user psychology, visual hierarchy, and interaction patterns to create interfaces that feel natural and intuitive.

## Fundamental Principles

### 1. Visual Hierarchy
Guide users through your interface with clear visual priorities:
- Use size, color, and spacing to establish hierarchy
- Group related elements together
- Create clear pathways for the user's eye to follow

### 2. Consistency
Maintain consistency throughout your interface:
- Use consistent colors, fonts, and spacing
- Follow established patterns and conventions
- Create a design system for scalability

### 3. Feedback and States
Provide clear feedback for user actions:
- Show loading states for async operations
- Highlight interactive elements on hover
- Provide clear error messages and success confirmations

## Design Systems

A well-structured design system includes:
- **Color palette** - Primary, secondary, and neutral colors
- **Typography** - Font families, sizes, and weights
- **Spacing** - Consistent margins and padding
- **Components** - Reusable UI elements
- **Icons** - Consistent iconography

## Tools and Workflow

### Design Tools
- **Figma** - Collaborative design and prototyping
- **Sketch** - Vector-based design tool
- **Adobe XD** - UI/UX design and prototyping

### Prototyping
Create interactive prototypes to test your designs:
- Test user flows and interactions
- Validate design decisions early
- Communicate ideas effectively to stakeholders

## User Testing

Always validate your designs with real users:
- Conduct usability testing sessions
- Gather feedback on navigation and layout
- Iterate based on user insights

## Conclusion

Creating intuitive user interfaces requires a deep understanding of both design principles and user needs. By following these guidelines and continuously testing with users, you can create interfaces that are both beautiful and functional.`,
        excerpt: 'Discover the principles and practices for creating intuitive and beautiful user interfaces.',
        author_username: 'sarah_designer',
        category_slug: 'ui-design',
        status: 'published',
        tags: 'ui design,user experience,design principles,interface',
        meta_title: 'UI Design Guide: Creating Intuitive Interfaces',
        meta_description: 'Learn the art of UI design and create intuitive user interfaces',
        reading_time: 10,
        is_featured: false
      },
      {
        title: 'Building a Scalable Node.js API with Express and PostgreSQL',
        slug: 'scalable-nodejs-api-express-postgresql',
        content: `# Building a Scalable Node.js API with Express and PostgreSQL

Creating a scalable API requires careful planning of your architecture, database design, and implementation patterns. In this tutorial, we'll build a robust API using Node.js, Express, and PostgreSQL.

## Project Setup

First, let's set up our project structure:

\`\`\`bash
mkdir scalable-api
cd scalable-api
npm init -y
npm install express pg dotenv cors helmet bcryptjs jsonwebtoken
npm install -D nodemon jest supertest
\`\`\`

## Database Design

Design your database schema with scalability in mind:

\`\`\`sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at);
\`\`\`

## Application Structure

Organize your code with a clear separation of concerns:

\`\`\`
src/
  controllers/
    authController.js
    postsController.js
  middleware/
    auth.js
    validation.js
  models/
    User.js
    Post.js
  routes/
    auth.js
    posts.js
  config/
    database.js
  utils/
    logger.js
\`\`\`

## Database Connection

Set up connection pooling for better performance:

\`\`\`javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;
\`\`\`

## API Routes

Create RESTful routes with proper error handling:

\`\`\`javascript
import express from 'express';
import { body, validationResult } from 'express-validator';

const router = express.Router();

router.post('/posts', 
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, content } = req.body;
      const post = await Post.create({ title, content, author_id: req.user.id });
      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
\`\`\`

## Performance Optimization

### 1. Caching
Implement Redis caching for frequently accessed data:

\`\`\`javascript
import redis from 'redis';
const client = redis.createClient();

const getPostsWithCache = async (page = 1) => {
  const cacheKey = \`posts:page:\${page}\`;
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const posts = await Post.findAll({ page });
  await client.setex(cacheKey, 300, JSON.stringify(posts)); // 5 min cache
  return posts;
};
\`\`\`

### 2. Database Indexing
Create indexes for commonly queried fields:

\`\`\`sql
CREATE INDEX idx_posts_title_search ON posts USING gin(to_tsvector('english', title));
CREATE INDEX idx_posts_created_desc ON posts(created_at DESC);
\`\`\`

## Security Best Practices

1. **Input Validation** - Validate all input data
2. **SQL Injection Prevention** - Use parameterized queries
3. **Authentication** - Implement JWT with proper expiration
4. **Rate Limiting** - Prevent abuse with rate limiting
5. **HTTPS** - Always use HTTPS in production

## Testing

Write comprehensive tests for your API:

\`\`\`javascript
import request from 'supertest';
import app from '../app.js';

describe('Posts API', () => {
  test('should create a new post', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', \`Bearer \${token}\`)
      .send({
        title: 'Test Post',
        content: 'This is a test post'
      });
      
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Post');
  });
});
\`\`\`

## Deployment

Deploy your API with proper monitoring and scaling:

\`\`\`yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: myapi
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:6-alpine

volumes:
  postgres_data:
\`\`\`

## Conclusion

Building a scalable API requires attention to architecture, performance, security, and testing. By following these patterns and practices, you can create APIs that handle growth gracefully.`,
        excerpt: 'Learn how to build a scalable Node.js API with Express and PostgreSQL, including best practices for performance and security.',
        author_username: 'mike_dev',
        category_slug: 'web-development',
        status: 'published',
        tags: 'nodejs,express,postgresql,api,scalability',
        meta_title: 'Scalable Node.js API Development Guide',
        meta_description: 'Complete guide to building scalable Node.js APIs with Express and PostgreSQL',
        reading_time: 15
      },
      {
        title: 'Career Transition: From Designer to Developer',
        slug: 'career-transition-designer-to-developer',
        content: `# Career Transition: From Designer to Developer

Making the transition from design to development can be challenging but incredibly rewarding. As someone who made this journey, I want to share insights and practical advice for designers looking to expand into development.

## Why Make the Transition?

### Benefits of Being a Designer-Developer
- **Complete creative control** over your projects
- **Higher market value** and more job opportunities
- **Better communication** with development teams
- **Ability to prototype** and iterate quickly
- **Deeper understanding** of technical constraints

## Essential Skills to Learn

### 1. HTML & CSS
Start with the fundamentals:
- Semantic HTML structure
- CSS flexbox and grid
- Responsive design principles
- CSS preprocessors (Sass/SCSS)

### 2. JavaScript
Learn programming concepts:
- Variables, functions, and data types
- DOM manipulation
- Event handling
- Async programming (promises, async/await)

### 3. Version Control
Master Git for collaboration:
- Basic commands (add, commit, push, pull)
- Branching and merging
- Collaboration workflows
- GitHub/GitLab usage

### 4. Development Tools
Familiarize yourself with:
- Code editors (VS Code, WebStorm)
- Browser developer tools
- Package managers (npm, yarn)
- Build tools (Webpack, Vite)

## Learning Path

### Phase 1: Foundations (2-3 months)
1. HTML & CSS fundamentals
2. Basic JavaScript
3. Git version control
4. Build simple static websites

### Phase 2: Interactive Development (3-4 months)
1. Advanced JavaScript concepts
2. DOM manipulation and events
3. API integration
4. Introduction to a framework (React/Vue)

### Phase 3: Framework Mastery (4-6 months)
1. Deep dive into your chosen framework
2. State management
3. Routing and navigation
4. Build portfolio projects

### Phase 4: Professional Development (Ongoing)
1. Testing frameworks
2. Performance optimization
3. CI/CD pipelines
4. Backend basics (optional)

## Leveraging Your Design Background

### Advantages You Already Have
- **Visual hierarchy** understanding
- **User experience** mindset
- **Problem-solving** skills
- **Attention to detail**
- **Creative thinking**

### How to Apply Design Skills
- Create beautiful, functional interfaces
- Understand user needs and pain points
- Bridge communication between design and development teams
- Prototype ideas quickly

## Common Challenges and Solutions

### Challenge 1: Logical Thinking
**Problem**: Design is visual, development is logical
**Solution**: Practice breaking down problems into smaller steps

### Challenge 2: Technical Concepts
**Problem**: Programming concepts can be abstract
**Solution**: Use visual analogies and build projects to understand concepts

### Challenge 3: Imposter Syndrome
**Problem**: Feeling like you don't belong in tech
**Solution**: Remember that diversity of backgrounds strengthens teams

## Building Your Portfolio

### Project Ideas for Designer-Developers
1. **Personal website** - Showcase both design and development skills
2. **Design system implementation** - Build a component library
3. **Interactive prototypes** - Bring your designs to life
4. **Redesign existing websites** - Show improvement skills
5. **Mobile-first responsive sites** - Demonstrate modern practices

### Portfolio Tips
- Show your process, not just the final result
- Include both design mockups and live code
- Write case studies explaining your decisions
- Demonstrate responsive design
- Include code samples and GitHub links

## Job Search Strategy

### Positioning Yourself
- Highlight your unique designer-developer perspective
- Emphasize user-centered thinking
- Show ability to work across disciplines
- Demonstrate communication skills

### Target Roles
- **Frontend Developer** - Focus on UI implementation
- **UI Developer** - Bridge between design and development
- **Full-stack Designer** - End-to-end product development
- **Design Systems Developer** - Build and maintain design systems
- **Developer Advocate** - Technical content and community

## Building Your Network

### Ways to Connect
- Join developer communities (Dev.to, Stack Overflow)
- Attend local meetups and conferences
- Contribute to open source projects
- Share your learning journey on social media
- Find mentors in both design and development

## Salary Expectations

Designer-developers often command premium salaries due to their unique skill set:
- **Junior level**: $60,000 - $80,000
- **Mid-level**: $80,000 - $120,000
- **Senior level**: $120,000 - $180,000+

*Salaries vary by location, company size, and specific skills*

## Conclusion

The transition from designer to developer is challenging but achievable with dedication and the right approach. Your design background is an asset, not a liability. Embrace the journey, be patient with yourself, and remember that the tech industry needs more people who understand both sides of product development.

## Resources for Continued Learning

### Online Platforms
- **FreeCodeCamp** - Free comprehensive curriculum
- **MDN Web Docs** - Authoritative web development documentation
- **JavaScript.info** - In-depth JavaScript tutorials
- **CSS-Tricks** - CSS techniques and best practices

### Books
- "Don't Make Me Think" by Steve Krug
- "Eloquent JavaScript" by Marijn Haverbeke
- "You Don't Know JS" series by Kyle Simpson
- "Refactoring UI" by Adam Wathan & Steve Schoger

### Communities
- Designer Hangout Slack
- Dev.to community
- Reddit: r/webdev, r/Frontend
- Twitter developer community

Good luck on your journey from designer to developer!`,
        excerpt: 'A comprehensive guide for designers transitioning into development, including learning paths, challenges, and career advice.',
        author_username: 'sarah_designer',
        category_slug: 'career',
        status: 'published',
        tags: 'career,transition,designer,developer,learning',
        meta_title: 'Designer to Developer Career Transition Guide',
        meta_description: 'Complete guide for designers transitioning to development careers',
        reading_time: 18
      }
    ];

    for (const data of postData) {
      try {
        // Find author
        const author = this.users.find(user => user.username === data.author_username);
        if (!author) {
          console.error(`❌ Author not found: ${data.author_username}`);
          continue;
        }

        // Find category
        const category = this.categories.find(cat => cat.slug === data.category_slug);

        // Check if post already exists
        const existingPost = await Database.get('SELECT id FROM posts WHERE slug = ?', [data.slug]);
        if (existingPost) {
          console.log(`⏭️  Post already exists: ${data.title}`);
          continue;
        }

        const postData = {
          ...data,
          author_id: author.id,
          category_id: category ? category.id : null,
          published_at: new Date().toISOString()
        };

        // Remove non-database fields
        delete postData.author_username;
        delete postData.category_slug;

        const post = await Post.create(postData);
        this.posts.push(post);
        console.log(`✅ Created post: ${post.title}`);
      } catch (error) {
        console.error(`❌ Failed to create post ${data.title}:`, error.message);
      }
    }
  }

  async seedComments() {
    console.log('🌱 Seeding comments...');
    
    if (this.posts.length === 0) {
      console.log('⏭️  No posts available for comments');
      return;
    }

    const commentData = [
      {
        content: 'Excellent article! This really helped me understand the modern web development landscape. The section on best practices is particularly valuable.',
        post_slug: 'getting-started-modern-web-development',
        author_username: 'alex_reader'
      },
      {
        content: 'Thanks for sharing this comprehensive guide. As someone just starting out, I appreciate the clear explanations and practical examples.',
        post_slug: 'getting-started-modern-web-development',
        author_username: 'mike_dev'
      },
      {
        content: 'The React patterns you\'ve outlined here are incredibly useful. I\'ve been struggling with performance optimization, and the memo examples are exactly what I needed.',
        post_slug: 'advanced-react-patterns-performance',
        author_username: 'jane_writer'
      },
      {
        content: 'Great insights on compound components! I hadn\'t considered this pattern before, but it makes so much sense for building flexible UIs.',
        post_slug: 'advanced-react-patterns-performance',
        author_username: 'sarah_designer'
      },
      {
        content: 'As a fellow designer learning development, this article resonates deeply with me. The learning path is spot-on with my experience.',
        post_slug: 'career-transition-designer-to-developer',
        author_username: 'alex_reader'
      },
      {
        content: 'This is incredibly comprehensive! I\'m bookmarking this for future reference. The salary expectations section is particularly helpful.',
        post_slug: 'career-transition-designer-to-developer',
        author_username: 'mike_dev'
      },
      {
        content: 'Love the emphasis on visual hierarchy and consistency. These principles are fundamental but often overlooked.',
        post_slug: 'art-ui-design-intuitive-interfaces',
        author_username: 'jane_writer'
      },
      {
        content: 'The Node.js API tutorial is fantastic! The code examples are clear and the architecture advice is solid.',
        post_slug: 'scalable-nodejs-api-express-postgresql',
        author_username: 'sarah_designer'
      }
    ];

    for (const data of commentData) {
      try {
        // Find post
        const post = this.posts.find(post => post.slug === data.post_slug);
        if (!post) {
          console.error(`❌ Post not found: ${data.post_slug}`);
          continue;
        }

        // Find author
        const author = this.users.find(user => user.username === data.author_username);
        if (!author) {
          console.error(`❌ Comment author not found: ${data.author_username}`);
          continue;
        }

        const commentData = {
          content: data.content,
          post_id: post.id,
          author_id: author.id
        };

        const comment = await Comment.create(commentData);
        console.log(`✅ Created comment on: ${post.title}`);
      } catch (error) {
        console.error(`❌ Failed to create comment:`, error.message);
      }
    }
  }

  async updateCounters() {
    console.log('🔄 Updating counters...');

    try {
      // Update post comment counts
      await Database.run(`
        UPDATE posts SET comment_count = (
          SELECT COUNT(*) FROM comments 
          WHERE comments.post_id = posts.id AND comments.is_approved = 1
        )
      `);

      // Update category post counts
      await Database.run(`
        UPDATE categories SET post_count = (
          SELECT COUNT(*) FROM posts 
          WHERE posts.category_id = categories.id AND posts.status = 'published'
        )
      `);

      console.log('✅ Counters updated');
    } catch (error) {
      console.error('❌ Failed to update counters:', error);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      console.log('🚀 Starting database seeding...\n');
      
      await this.seedUsers();
      console.log('');
      
      await this.seedCategories();
      console.log('');
      
      await this.seedPosts();
      console.log('');
      
      await this.seedComments();
      console.log('');
      
      await this.updateCounters();
      console.log('');
      
      console.log('🎉 Database seeding completed successfully!');
      
      // Print summary
      console.log('\n📊 Summary:');
      console.log(`Users: ${this.users.length}`);
      console.log(`Categories: ${this.categories.length}`);
      console.log(`Posts: ${this.posts.length}`);
      
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    } finally {
      await Database.close();
    }
  }

  async clear() {
    try {
      await this.initialize();
      
      console.log('🗑️  Clearing database...');
      
      // Clear in reverse order due to foreign key constraints
      await Database.run('DELETE FROM comments');
      await Database.run('DELETE FROM post_likes');
      await Database.run('DELETE FROM post_categories');
      await Database.run('DELETE FROM posts');
      await Database.run('DELETE FROM user_sessions');
      await Database.run('DELETE FROM refresh_tokens');
      await Database.run('DELETE FROM categories');
      await Database.run('DELETE FROM users');
      await Database.run('DELETE FROM audit_logs');
      
      // Reset auto-increment counters
      await Database.run('DELETE FROM sqlite_sequence');
      
      console.log('✅ Database cleared');
    } catch (error) {
      console.error('❌ Failed to clear database:', error);
      process.exit(1);
    } finally {
      await Database.close();
    }
  }
}

// CLI handling
const seeder = new Seeder();
const command = process.argv[2];

switch (command) {
  case 'run':
    seeder.run();
    break;
  case 'clear':
    seeder.clear();
    break;
  default:
    console.log('Usage:');
    console.log('  node seed.js run    - Seed the database with sample data');
    console.log('  node seed.js clear  - Clear all data from the database');
    break;
}