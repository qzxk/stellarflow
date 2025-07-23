import { Database } from '../src/config/database.js';
import Product from '../src/models/Product.js';
import User from '../src/models/User.js';

const sampleProducts = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
    price: 79.99,
    stock_quantity: 50,
    sku: 'WBH001',
    image_url: 'https://example.com/images/headphones.jpg',
    weight: 0.5,
    dimensions: '20x18x8 cm'
  },
  {
    name: 'Smart Watch Pro',
    description: 'Advanced fitness tracker with heart rate monitor, GPS, and water resistance.',
    price: 199.99,
    stock_quantity: 30,
    sku: 'SWP001',
    image_url: 'https://example.com/images/smartwatch.jpg',
    weight: 0.1,
    dimensions: '4x4x1 cm'
  },
  {
    name: 'Portable Power Bank 20000mAh',
    description: 'Fast charging power bank with dual USB ports and LED display.',
    price: 49.99,
    stock_quantity: 100,
    sku: 'PPB001',
    image_url: 'https://example.com/images/powerbank.jpg',
    weight: 0.4,
    dimensions: '15x7x2 cm'
  },
  {
    name: 'Mechanical Gaming Keyboard',
    description: 'RGB backlit mechanical keyboard with customizable keys and macro support.',
    price: 129.99,
    stock_quantity: 25,
    sku: 'MGK001',
    image_url: 'https://example.com/images/keyboard.jpg',
    weight: 1.2,
    dimensions: '45x15x3 cm'
  },
  {
    name: 'Wireless Gaming Mouse',
    description: 'Precision gaming mouse with 16000 DPI sensor and programmable buttons.',
    price: 89.99,
    stock_quantity: 40,
    sku: 'WGM001',
    image_url: 'https://example.com/images/mouse.jpg',
    weight: 0.15,
    dimensions: '12x7x4 cm'
  },
  {
    name: 'USB-C Hub 7-in-1',
    description: 'Multi-port USB-C hub with HDMI, USB 3.0, SD card reader, and PD charging.',
    price: 59.99,
    stock_quantity: 60,
    sku: 'UCH001',
    image_url: 'https://example.com/images/usb-hub.jpg',
    weight: 0.2,
    dimensions: '10x5x1.5 cm'
  },
  {
    name: 'Laptop Stand Adjustable',
    description: 'Ergonomic aluminum laptop stand with adjustable height and angle.',
    price: 39.99,
    stock_quantity: 45,
    sku: 'LSA001',
    image_url: 'https://example.com/images/laptop-stand.jpg',
    weight: 0.8,
    dimensions: '30x25x5 cm'
  },
  {
    name: 'Webcam 1080p HD',
    description: 'Full HD webcam with auto-focus, noise-canceling mic, and privacy cover.',
    price: 69.99,
    stock_quantity: 35,
    sku: 'WC1080P',
    image_url: 'https://example.com/images/webcam.jpg',
    weight: 0.25,
    dimensions: '10x8x7 cm'
  },
  {
    name: 'Bluetooth Speaker Waterproof',
    description: 'Portable waterproof speaker with 360° sound and 12-hour battery life.',
    price: 99.99,
    stock_quantity: 20,
    sku: 'BSW001',
    image_url: 'https://example.com/images/speaker.jpg',
    weight: 0.6,
    dimensions: '20x8x8 cm'
  },
  {
    name: 'Wireless Charging Pad',
    description: 'Fast wireless charger compatible with all Qi-enabled devices.',
    price: 29.99,
    stock_quantity: 80,
    sku: 'WCP001',
    image_url: 'https://example.com/images/charger.jpg',
    weight: 0.15,
    dimensions: '10x10x1 cm'
  }
];

async function seedProducts() {
  try {
    console.log('🌱 Starting product seeding...');
    
    // Initialize database
    await Database.initialize();
    
    // Get the first admin or create a test user
    let user = await Database.getConnection().get('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    
    if (!user) {
      // Create a test admin user
      console.log('Creating test admin user...');
      const testUser = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'Admin123!',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      });
      user = testUser;
    }
    
    console.log(`Using user ID ${user.id} as product creator`);
    
    // Create products
    let created = 0;
    for (const productData of sampleProducts) {
      try {
        // Check if product with SKU already exists
        const existing = await Product.findBySku(productData.sku);
        if (existing) {
          console.log(`⚠️  Product with SKU ${productData.sku} already exists, skipping...`);
          continue;
        }
        
        const product = await Product.create({
          ...productData,
          created_by: user.id
        });
        created++;
        console.log(`✅ Created product: ${product.name} (SKU: ${product.sku})`);
      } catch (error) {
        console.error(`❌ Failed to create product ${productData.name}:`, error.message);
      }
    }
    
    console.log(`\n✨ Product seeding completed! Created ${created} new products.`);
    
    // Get statistics
    const stats = await Product.getStatistics();
    console.log('\n📊 Product Statistics:');
    console.log(`   Total Products: ${stats.total_products}`);
    console.log(`   Total Stock: ${stats.total_stock}`);
    console.log(`   Average Price: $${parseFloat(stats.average_price).toFixed(2)}`);
    console.log(`   Price Range: $${parseFloat(stats.min_price).toFixed(2)} - $${parseFloat(stats.max_price).toFixed(2)}`);
    console.log(`   Out of Stock: ${stats.out_of_stock_count}`);
    console.log(`   Low Stock: ${stats.low_stock_count}`);
    
  } catch (error) {
    console.error('❌ Product seeding failed:', error);
    process.exit(1);
  } finally {
    await Database.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedProducts();
}

export default seedProducts;