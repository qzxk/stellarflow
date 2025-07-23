# REST API Project

A production-ready REST API built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Database Integration**: PostgreSQL with connection pooling and query optimization
- **API Documentation**: Comprehensive API documentation with example requests/responses
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Error Handling**: Centralized error handling with proper status codes
- **Logging**: Request logging with Winston for debugging and monitoring
- **Security**: CORS, Helmet, and other security best practices
- **Testing**: Unit and integration tests with Jest
- **Docker Support**: Containerized deployment with Docker Compose

## Project Structure

```
rest-api/
├── src/
│   ├── config/         # Database and app configuration
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── server.js       # Express server setup
├── scripts/
│   ├── migrations/     # Database migrations
│   ├── migrate.js      # Migration runner
│   └── seed.js         # Database seeding
├── tests/              # Test files
├── .env.example        # Environment variables template
├── docker-compose.yml  # Docker configuration
├── package.json        # Dependencies
└── README.md           # This file
```

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Docker and Docker Compose (optional)

## Getting Started

### 1. Clone and Install

```bash
# Install dependencies
npm install
```

### 2. Environment Setup

Copy the `.env.example` file to `.env` and update with your values:

```bash
cp .env.example .env
```

### 3. Database Setup

#### Using Docker (Recommended)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Run migrations
npm run migrate

# Seed the database (optional)
npm run seed
```

#### Using Local PostgreSQL

1. Create a database:
```sql
CREATE DATABASE rest_api_db;
```

2. Update `.env` with your database credentials

3. Run migrations:
```bash
npm run migrate
```

### 4. Start the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

## Development

### Running with Docker Compose

```bash
# Start all services (API + PostgreSQL)
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Database Migrations

```bash
# Create a new migration
npm run migrate:create -- migration-name

# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API documentation including:
- Authentication endpoints
- User management
- Post CRUD operations
- Comment system
- Category management

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `BCRYPT_ROUNDS` | Bcrypt salt rounds | 10 |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | 900000 |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `LOG_LEVEL` | Logging level | info |

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed the database
- `npm run build` - Build for production
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run with Docker Compose

## Deployment

### Using Docker

1. Build the image:
```bash
docker build -t rest-api .
```

2. Run with environment variables:
```bash
docker run -p 3000:3000 --env-file .env rest-api
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the app
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### Health Check

The API includes a health check endpoint at `/health` that returns:
- API status
- Database connectivity
- Current version
- Uptime

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens are used for authentication
- Rate limiting prevents brute force attacks
- CORS is configured for specific origins
- SQL injection prevention through parameterized queries
- Input validation on all endpoints
- Security headers via Helmet

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.