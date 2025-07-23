# Stellar API

A comprehensive REST API built with Express.js, PostgreSQL, and JWT authentication.

## 🚀 Features

- **RESTful API Design**: Clean, intuitive endpoints following REST best practices
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **PostgreSQL Database**: Robust relational database with migrations and seeders
- **Role-Based Access Control**: Fine-grained permissions system
- **Input Validation**: Comprehensive request validation using Joi
- **Error Handling**: Consistent error responses with helpful messages
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Testing Suite**: Unit, integration, and E2E tests with >90% coverage
- **Security**: Rate limiting, CORS, Helmet, and other security best practices
- **Logging**: Structured logging with Winston
- **Docker Support**: Containerized deployment ready

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- npm >= 9.0.0

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stellar-api.git
cd stellar-api
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create database
createdb stellar_api

# Run migrations
npm run db:migrate

# Seed the database (optional)
npm run db:seed
```

5. Start the server:
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Once the server is running, access the interactive API documentation at:
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`

## 🧪 Testing

Run the test suite:
```bash
# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

## 📁 Project Structure

```
stellar-api/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   ├── validators/     # Input validators
│   └── server.js       # Express app setup
├── tests/              # Test files
├── docs/               # Documentation
├── scripts/            # Utility scripts
└── logs/               # Application logs
```

## 🔐 Authentication

The API uses JWT tokens for authentication. To access protected endpoints:

1. Register a new user at `POST /api/v2/auth/register`
2. Login at `POST /api/v2/auth/login` to receive access and refresh tokens
3. Include the access token in requests: `Authorization: Bearer <token>`
4. Refresh tokens at `POST /api/v2/auth/refresh` when access token expires

## 🚦 Available Endpoints

### Authentication
- `POST /api/v2/auth/register` - Register new user
- `POST /api/v2/auth/login` - Login user
- `POST /api/v2/auth/refresh` - Refresh access token
- `POST /api/v2/auth/logout` - Logout user
- `POST /api/v2/auth/forgot-password` - Request password reset
- `POST /api/v2/auth/reset-password` - Reset password

### Users
- `GET /api/v2/users` - List users (admin only)
- `GET /api/v2/users/:id` - Get user details
- `PUT /api/v2/users/:id` - Update user
- `DELETE /api/v2/users/:id` - Delete user

### Products
- `GET /api/v2/products` - List products
- `POST /api/v2/products` - Create product
- `GET /api/v2/products/:id` - Get product details
- `PUT /api/v2/products/:id` - Update product
- `DELETE /api/v2/products/:id` - Delete product

### Orders
- `GET /api/v2/orders` - List orders
- `POST /api/v2/orders` - Create order
- `GET /api/v2/orders/:id` - Get order details
- `PUT /api/v2/orders/:id` - Update order
- `DELETE /api/v2/orders/:id` - Cancel order

## 🔧 Configuration

Key configuration options in `.env`:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `DB_*` - Database connection settings
- `JWT_*` - JWT token configuration
- `RATE_LIMIT_*` - Rate limiting settings

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t stellar-api .

# Run container
docker run -p 3000:3000 --env-file .env stellar-api
```

Or use Docker Compose:

```bash
docker-compose up
```

## 📈 Performance

- Response time: p95 < 200ms
- Throughput: 1000+ requests/second
- Database queries optimized with indexes
- Connection pooling for database efficiency
- Response compression enabled

## 🔒 Security

- JWT authentication with secure token storage
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- CORS configured for allowed origins
- Security headers with Helmet
- Input validation and sanitization
- SQL injection protection
- XSS prevention

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- StellarFlow Team

## 🙏 Acknowledgments

- Built with Express.js
- Database powered by PostgreSQL
- Documentation with Swagger
- Testing with Jest

---

For more information, check the [API Documentation](http://localhost:3000/api-docs) or the [docs](./docs) directory.