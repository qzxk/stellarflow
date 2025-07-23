import dotenv from 'dotenv';
import { Database } from '../src/config/postgres.js';
import User from '../src/models/UserPG.js';
import Product from '../src/models/ProductPG.js';
import Order from '../src/models/OrderPG.js';
import RefreshToken from '../src/models/RefreshTokenPG.js';

dotenv.config();

// Sample data
const sampleUsers = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    full_name: 'Admin User',
    role: 'admin',
    is_verified: true,
  },
  {
    email: 'john.doe@example.com',
    password: 'password123',
    full_name: 'John Doe',
    role: 'user',
    is_verified: true,
  },
  {
    email: 'jane.smith@example.com',
    password: 'password123',
    full_name: 'Jane Smith',
    role: 'user',
    is_verified: true,
  },
  {
    email: 'moderator@example.com',
    password: 'mod123',
    full_name: 'Moderator User',
    role: 'moderator',
    is_verified: true,
  },
];

const sampleProducts = [
  {
    name: 'Laptop Pro 15"',
    description: 'High-performance laptop with 16GB RAM and 512GB SSD',
    price: 1299.99,
    sku: 'LAPTOP-PRO-15',
    category: 'Electronics',
    tags: ['laptop', 'computer', 'electronics'],
    stock_quantity: 50,
  },
  {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with precision tracking',
    price: 29.99,
    sku: 'MOUSE-WL-001',
    category: 'Accessories',
    tags: ['mouse', 'wireless', 'accessories'],
    stock_quantity: 200,
  },
  {
    name: 'USB-C Hub',
    description: '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader',
    price: 49.99,
    sku: 'HUB-USBC-7IN1',
    category: 'Accessories',
    tags: ['hub', 'usb-c', 'accessories'],
    stock_quantity: 150,
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with blue switches',
    price: 89.99,
    sku: 'KB-MECH-RGB',
    category: 'Accessories',
    tags: ['keyboard', 'mechanical', 'rgb'],
    stock_quantity: 75,
  },
  {
    name: '27" 4K Monitor',
    description: 'Professional 4K monitor with HDR support',
    price: 449.99,
    sku: 'MON-4K-27',
    category: 'Electronics',
    tags: ['monitor', '4k', 'display'],
    stock_quantity: 30,
  },
  {
    name: 'Webcam HD',
    description: '1080p HD webcam with auto-focus and noise cancellation',
    price: 79.99,
    sku: 'CAM-HD-1080',
    category: 'Electronics',
    tags: ['webcam', 'camera', 'video'],
    stock_quantity: 100,
  },
  {
    name: 'Desk Lamp LED',
    description: 'Adjustable LED desk lamp with touch controls',
    price: 39.99,
    sku: 'LAMP-LED-01',
    category: 'Office',
    tags: ['lamp', 'led', 'office'],
    stock_quantity: 5, // Low stock
  },
  {
    name: 'Standing Desk Converter',
    description: 'Adjustable standing desk converter for healthy working',
    price: 199.99,
    sku: 'DESK-STAND-01',
    category: 'Office',
    tags: ['desk', 'standing', 'ergonomic'],
    stock_quantity: 0, // Out of stock
  },
  {
    name: 'Laptop Backpack',
    description: 'Water-resistant laptop backpack with multiple compartments',
    price: 59.99,
    sku: 'BAG-LAPTOP-01',
    category: 'Accessories',
    tags: ['backpack', 'laptop', 'bag'],
    stock_quantity: 80,
  },
  {
    name: 'Wireless Headphones',
    description: 'Noise-cancelling wireless headphones with 30-hour battery',
    price: 249.99,
    sku: 'AUDIO-WH-NC',
    category: 'Electronics',
    tags: ['headphones', 'wireless', 'audio'],
    stock_quantity: 40,
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Initialize database connection
    await Database.initialize();
    console.log('✅ Database connection established\n');

    // Clear existing data (optional - be careful in production!)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🗑️  Clearing existing data...');
      
      // Delete in correct order due to foreign key constraints
      await Database.query('DELETE FROM order_items');
      await Database.query('DELETE FROM orders');
      await Database.query('DELETE FROM refresh_tokens');
      await Database.query('DELETE FROM products');
      await Database.query('DELETE FROM users');
      
      console.log('✅ Existing data cleared\n');
    }

    // Seed users
    console.log('👥 Seeding users...');
    const createdUsers = [];
    
    for (const userData of sampleUsers) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`  ✅ Created user: ${user.email} (${user.role})`);
    }
    
    console.log(`\n✅ Created ${createdUsers.length} users\n`);

    // Seed products
    console.log('📦 Seeding products...');
    const createdProducts = [];
    
    // Assign random creator to each product
    for (const productData of sampleProducts) {
      const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const product = await Product.create({
        ...productData,
        created_by: randomUser.id,
      });
      createdProducts.push(product);
      console.log(`  ✅ Created product: ${product.name} (SKU: ${product.sku})`);
    }
    
    console.log(`\n✅ Created ${createdProducts.length} products\n`);

    // Create sample orders
    console.log('🛒 Creating sample orders...');
    const createdOrders = [];
    
    // Create a few orders for regular users
    const regularUsers = createdUsers.filter(u => u.role === 'user');
    
    for (const user of regularUsers) {
      // Create 1-3 orders per user
      const orderCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < orderCount; i++) {
        // Random order data
        const orderData = {
          user_id: user.id,
          shipping_address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345',
            country: 'USA'
          },
          billing_address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345',
            country: 'USA'
          },
          payment_method: ['credit_card', 'paypal', 'stripe'][Math.floor(Math.random() * 3)],
          shipping_amount: 9.99,
          tax_amount: 0,
        };

        const order = await Order.create(orderData);
        
        // Add random products to order
        const productCount = Math.floor(Math.random() * 4) + 1;
        const selectedProducts = [];
        let subtotal = 0;
        
        for (let j = 0; j < productCount; j++) {
          const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
          if (!selectedProducts.find(p => p.id === product.id)) {
            selectedProducts.push(product);
            const quantity = Math.floor(Math.random() * 3) + 1;
            await order.addItem({
              product_id: product.id,
              quantity: quantity,
              unit_price: product.price,
            });
            subtotal += product.price * quantity;
          }
        }

        // Update order totals
        order.subtotal = subtotal;
        order.tax_amount = subtotal * 0.08; // 8% tax
        order.total_amount = subtotal + order.tax_amount + order.shipping_amount;
        await order.save();

        // Randomly set some orders as paid/shipped
        const random = Math.random();
        if (random > 0.7) {
          await order.updateStatus('delivered');
          await order.updatePaymentStatus('paid');
        } else if (random > 0.4) {
          await order.updateStatus('shipped');
          await order.updatePaymentStatus('paid');
        } else if (random > 0.2) {
          await order.updatePaymentStatus('paid');
        }

        createdOrders.push(order);
        console.log(`  ✅ Created order ${order.order_number} for ${user.email}`);
      }
    }
    
    console.log(`\n✅ Created ${createdOrders.length} orders\n`);

    // Display summary statistics
    console.log('📊 Database Statistics:');
    
    const userStats = await User.getStatistics();
    console.log('\n👥 Users:');
    console.log(`  Total: ${userStats.total_users}`);
    console.log(`  Admins: ${userStats.admin_count}`);
    console.log(`  Moderators: ${userStats.moderator_count}`);
    console.log(`  Regular Users: ${userStats.user_count}`);

    const productStats = await Product.getStatistics();
    console.log('\n📦 Products:');
    console.log(`  Total: ${productStats.total_products}`);
    console.log(`  In Stock: ${productStats.in_stock_count}`);
    console.log(`  Low Stock: ${productStats.low_stock_count}`);
    console.log(`  Out of Stock: ${productStats.out_of_stock_count}`);
    console.log(`  Average Price: $${productStats.average_price}`);
    console.log(`  Total Inventory Value: $${productStats.total_inventory_value}`);

    const orderStats = await Order.getStatistics();
    console.log('\n🛒 Orders:');
    console.log(`  Total: ${orderStats.total_orders}`);
    console.log(`  Paid: ${orderStats.paid_orders}`);
    console.log(`  Delivered: ${orderStats.delivered_orders}`);
    console.log(`  Average Order Value: $${orderStats.average_order_value}`);
    console.log(`  Total Revenue: $${orderStats.total_revenue}`);

    console.log('\n✅ Database seeding completed successfully!');
    
    // Test credentials
    console.log('\n🔑 Test Credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  User: john.doe@example.com / password123');
    console.log('  User: jane.smith@example.com / password123');
    console.log('  Moderator: moderator@example.com / mod123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await Database.close();
  }
}

// Run seeder
seedDatabase();