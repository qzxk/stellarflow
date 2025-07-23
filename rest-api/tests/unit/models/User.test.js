import User from '../../../src/models/User.js';
import { Database } from '../../../src/config/database.js';
import bcrypt from 'bcryptjs';
import { userFactory } from '../../fixtures/users.fixture.js';

// Mock the database
jest.mock('../../../src/config/database.js');
jest.mock('bcryptjs');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default bcrypt behavior
    bcrypt.hash.mockResolvedValue('hashed-password');
    bcrypt.compare.mockResolvedValue(true);
  });

  describe('constructor', () => {
    it('should create a user instance with all properties', () => {
      const userData = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        avatar_url: 'avatar.jpg',
        bio: 'Test bio',
        role: 'admin',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const user = new User(userData);

      expect(user.id).toBe(userData.id);
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.password_hash).toBe(userData.password_hash);
      expect(user.first_name).toBe(userData.first_name);
      expect(user.last_name).toBe(userData.last_name);
      expect(user.avatar_url).toBe(userData.avatar_url);
      expect(user.bio).toBe(userData.bio);
      expect(user.role).toBe(userData.role);
      expect(user.is_active).toBe(userData.is_active);
      expect(user.created_at).toBe(userData.created_at);
      expect(user.updated_at).toBe(userData.updated_at);
    });

    it('should set default values for role and is_active', () => {
      const user = new User({});
      expect(user.role).toBe('user');
      expect(user.is_active).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = userFactory();
      const mockUserId = 1;

      Database.run.mockResolvedValue({ lastID: mockUserId });
      Database.get.mockResolvedValue({
        id: mockUserId,
        ...userData,
        password_hash: 'hashed-password'
      });

      const user = await User.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(Database.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          userData.username,
          userData.email,
          'hashed-password',
          userData.firstName,
          userData.lastName
        ])
      );
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(mockUserId);
    });

    it('should throw error on database failure', async () => {
      const userData = userFactory();
      Database.run.mockRejectedValue(new Error('Database error'));

      await expect(User.create(userData)).rejects.toThrow('Failed to create user: Database error');
    });

    it('should use custom bcrypt rounds from environment', async () => {
      process.env.BCRYPT_ROUNDS = '15';
      const userData = userFactory();

      Database.run.mockResolvedValue({ lastID: 1 });
      Database.get.mockResolvedValue({ id: 1, ...userData });

      await User.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 15);
      delete process.env.BCRYPT_ROUNDS;
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      Database.get.mockResolvedValue(mockUser);

      const user = await User.findById(1);

      expect(Database.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        [1]
      );
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(mockUser.id);
    });

    it('should return null if user not found', async () => {
      Database.get.mockResolvedValue(null);

      const user = await User.findById(999);

      expect(user).toBeNull();
    });

    it('should throw error on database failure', async () => {
      Database.get.mockRejectedValue(new Error('Database error'));

      await expect(User.findById(1)).rejects.toThrow('Failed to find user by ID: Database error');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      Database.get.mockResolvedValue(mockUser);

      const user = await User.findByEmail('test@example.com');

      expect(Database.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe(mockUser.email);
    });

    it('should return null if user not found', async () => {
      Database.get.mockResolvedValue(null);

      const user = await User.findByEmail('notfound@example.com');

      expect(user).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      Database.get.mockResolvedValue(mockUser);

      const user = await User.findByUsername('testuser');

      expect(Database.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = ?',
        ['testuser']
      );
      expect(user).toBeInstanceOf(User);
      expect(user.username).toBe(mockUser.username);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of active users', async () => {
      const mockUsers = [
        { id: 1, username: 'user1', is_active: 1 },
        { id: 2, username: 'user2', is_active: 1 }
      ];

      Database.query.mockResolvedValue(mockUsers);

      const users = await User.findAll(10, 0);

      expect(Database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = 1'),
        [10, 0]
      );
      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
    });

    it('should use default pagination values', async () => {
      Database.query.mockResolvedValue([]);

      await User.findAll();

      expect(Database.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 0]
      );
    });
  });

  describe('update', () => {
    it('should update allowed fields', async () => {
      const user = new User({ id: 1 });
      const updateData = {
        username: 'newusername',
        email: 'new@example.com',
        bio: 'New bio'
      };

      Database.run.mockResolvedValue({});
      Database.get.mockResolvedValue({ id: 1, ...updateData });

      const updatedUser = await user.update(updateData);

      expect(Database.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['newusername', 'new@example.com', 'New bio', 1])
      );
      expect(updatedUser).toBeInstanceOf(User);
    });

    it('should ignore non-allowed fields', async () => {
      const user = new User({ id: 1 });
      const updateData = {
        username: 'newusername',
        password_hash: 'should-be-ignored',
        id: 999
      };

      Database.run.mockResolvedValue({});
      Database.get.mockResolvedValue({ id: 1, username: 'newusername' });

      await user.update(updateData);

      const sqlCall = Database.run.mock.calls[0][0];
      expect(sqlCall).not.toContain('password_hash');
      expect(sqlCall).not.toContain('id =');
    });

    it('should throw error if no valid fields to update', async () => {
      const user = new User({ id: 1 });
      const updateData = {
        invalid_field: 'value'
      };

      await expect(user.update(updateData)).rejects.toThrow('No valid fields to update');
    });
  });

  describe('delete', () => {
    it('should soft delete user', async () => {
      const user = new User({ id: 1 });
      Database.run.mockResolvedValue({});

      const result = await user.delete();

      expect(Database.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET is_active = 0'),
        [1]
      );
      expect(result).toBe(true);
    });

    it('should throw error on database failure', async () => {
      const user = new User({ id: 1 });
      Database.run.mockRejectedValue(new Error('Database error'));

      await expect(user.delete()).rejects.toThrow('Failed to delete user: Database error');
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete user', async () => {
      const user = new User({ id: 1 });
      Database.run.mockResolvedValue({});

      const result = await user.hardDelete();

      expect(Database.run).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        [1]
      );
      expect(result).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const user = new User({ password_hash: 'hashed-password' });
      bcrypt.compare.mockResolvedValue(true);

      const result = await user.verifyPassword('correct-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const user = new User({ password_hash: 'hashed-password' });
      bcrypt.compare.mockResolvedValue(false);

      const result = await user.verifyPassword('wrong-password');

      expect(result).toBe(false);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const user = new User({ id: 1 });
      const newPassword = 'new-password';
      
      Database.run.mockResolvedValue({});

      const result = await user.updatePassword(newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(Database.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash'),
        ['hashed-password', 1]
      );
      expect(result).toBe(true);
    });
  });

  describe('getTotalCount', () => {
    it('should return total active user count', async () => {
      Database.get.mockResolvedValue({ count: 42 });

      const count = await User.getTotalCount();

      expect(Database.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
      );
      expect(count).toBe(42);
    });
  });

  describe('search', () => {
    it('should search users by query', async () => {
      const mockUsers = [
        { id: 1, username: 'john_doe' },
        { id: 2, username: 'jane_doe' }
      ];

      Database.query.mockResolvedValue(mockUsers);

      const users = await User.search('doe', 10, 0);

      expect(Database.query).toHaveBeenCalledWith(
        expect.stringContaining('username LIKE ? OR'),
        ['%doe%', '%doe%', '%doe%', '%doe%', 10, 0]
      );
      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
    });
  });

  describe('getPosts', () => {
    it('should get user posts', async () => {
      const user = new User({ id: 1 });
      const mockPosts = [
        { id: 1, title: 'Post 1' },
        { id: 2, title: 'Post 2' }
      ];

      Database.query.mockResolvedValue(mockPosts);

      const posts = await user.getPosts(5, 0);

      expect(Database.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM posts WHERE author_id = ?'),
        [1, 5, 0]
      );
      expect(posts).toEqual(mockPosts);
    });
  });

  describe('toSafeObject', () => {
    it('should exclude password_hash from object', () => {
      const user = new User({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'secret-hash',
        role: 'user'
      });

      const safeObj = user.toSafeObject();

      expect(safeObj).not.toHaveProperty('password_hash');
      expect(safeObj.username).toBe('testuser');
      expect(safeObj.email).toBe('test@example.com');
    });
  });

  describe('toJSON', () => {
    it('should return safe object for JSON serialization', () => {
      const user = new User({
        id: 1,
        username: 'testuser',
        password_hash: 'secret-hash'
      });

      const json = user.toJSON();

      expect(json).not.toHaveProperty('password_hash');
      expect(json.username).toBe('testuser');
    });
  });
});