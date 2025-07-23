const { User, Product } = require('./models');
const { pool } = require('./connection');

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Check if data already exists
    const userCount = await User.count({});
    if (userCount > 0) {
      console.log('Database already contains data, skipping seed');
      return;
    }

    // Create admin user
    const adminUser = await User.create({
      email: 'admin@example.com',
      password: 'admin123',
      fullName: 'System Administrator',
      role: 'admin'
    });
    
    // Verify admin user
    await adminUser.verify();
    console.log('Created admin user:', adminUser.email);

    // Create test users
    const testUser1 = await User.create({
      email: 'john.doe@example.com',
      password: 'password123',
      fullName: 'John Doe',
      role: 'user'
    });
    await testUser1.verify();
    console.log('Created test user:', testUser1.email);

    const testUser2 = await User.create({
      email: 'jane.smith@example.com',
      password: 'password123',
      fullName: 'Jane Smith',
      role: 'user'
    });
    await testUser2.verify();
    console.log('Created test user:', testUser2.email);

    // Create sample products
    const products = [
      {
        name: 'Laptop Pro 15"',
        description: 'High-performance laptop with 16GB RAM and 512GB SSD',
        price: 1299.99,
        sku: 'LAPTOP-PRO-15',
        category: 'Electronics',
        tags: ['laptop', 'computer', 'electronics'],
        stockQuantity: 50,
        createdBy: adminUser.id
      },
      {
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with precision tracking',
        price: 29.99,
        sku: 'MOUSE-WL-001',
        category: 'Accessories',
        tags: ['mouse', 'wireless', 'accessories'],
        stockQuantity: 200,
        createdBy: adminUser.id
      },
      {
        name: 'USB-C Hub',
        description: '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader',
        price: 49.99,
        sku: 'HUB-USBC-7IN1',
        category: 'Accessories',
        tags: ['hub', 'usb-c', 'accessories'],
        stockQuantity: 150,
        createdBy: testUser1.id
      },
      {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical keyboard with Cherry MX switches',
        price: 89.99,
        sku: 'KB-MECH-RGB',
        category: 'Accessories',
        tags: ['keyboard', 'mechanical', 'rgb', 'gaming'],
        stockQuantity: 75,
        createdBy: testUser1.id
      },
      {
        name: '27" 4K Monitor',
        description: 'Ultra HD 4K monitor with HDR support',
        price: 399.99,
        sku: 'MON-4K-27',
        category: 'Electronics',
        tags: ['monitor', '4k', 'display'],
        stockQuantity: 30,
        createdBy: testUser2.id
      },
      {
        name: 'Webcam HD',
        description: '1080p HD webcam with built-in microphone',
        price: 59.99,
        sku: 'CAM-HD-1080',
        category: 'Electronics',
        tags: ['webcam', 'camera', 'video'],
        stockQuantity: 100,
        createdBy: testUser2.id
      }
    ];

    for (const productData of products) {
      const product = await Product.create(productData);
      console.log(`Created product: ${product.name}`);
    }

    console.log('\nDatabase seeding completed successfully!');
    console.log('\nTest credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('User 1: john.doe@example.com / password123');
    console.log('User 2: jane.smith@example.com / password123');

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedDatabase;