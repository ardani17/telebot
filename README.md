# TeleWeb - Telegram Bot Web Integration

Sistem terintegrasi antara Telegram Bot dan Web Application menggunakan teknologi modern untuk memproses berbagai jenis file dan data melalui bot Telegram dengan interface web untuk manajemen.

## 🏗️ Arsitektur Sistem

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Telegram Bot  │
│   (React)       │◄──►│   (NestJS)      │◄──►│   (Telegraf)    │
│   Port: 3000    │    │   Port: 3001    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   PostgreSQL    │              │
         └──────────────►│   Port: 5432    │◄─────────────┘
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │     Redis       │
                        │   Port: 6379    │
                        └─────────────────┘
```

## 🚀 Tech Stack

### Frontend
- **React 18** - UI Library
- **Vite** - Build tool dan dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling framework
- **Shadcn/ui** - Pre-built UI components
- **TanStack Query** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **React Router** - Client-side routing

### Backend
- **NestJS** - Node.js framework
- **TypeScript** - Type safety
- **Prisma** - ORM dan database toolkit
- **PostgreSQL** - Primary database
- **Redis** - Caching dan session storage
- **JWT** - Authentication tokens
- **Passport.js** - Authentication strategies
- **Winston** - Logging library
- **Zod** - Schema validation
- **Class Validator** - DTO validation
- **Swagger/OpenAPI** - API documentation

### Bot
- **Node.js** - Runtime environment
- **TypeScript** - Type safety
- **Telegraf** - Telegram bot framework
- **Local Bot API Server** - https://github.com/tdlib/telegram-bot-api
- **Winston** - Logging
- **Zod** - Input validation

### DevOps & Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **PM2** - Process manager untuk production

## 📁 Struktur Project

```
teleweb/
├── backend/                 # NestJS Backend API
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── users/          # User management
│   │   ├── features/       # Feature management
│   │   ├── files/          # File handling
│   │   ├── bot/            # Bot integration
│   │   ├── websocket/      # Real-time communication
│   │   ├── prisma/         # Database service
│   │   └── health/         # Health checks
│   ├── prisma/             # Database schema & migrations
│   └── package.json
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities
│   │   └── types/          # Type definitions
│   └── package.json
├── bot/                    # Telegram Bot
│   ├── src/
│   │   ├── bot/            # Bot manager & handlers
│   │   ├── features/       # Feature implementations
│   │   ├── services/       # External services
│   │   └── utils/          # Utilities
│   └── package.json
├── shared/                 # Shared types & utilities
│   ├── src/
│   │   ├── types/          # Shared type definitions
│   │   ├── schemas/        # Zod validation schemas
│   │   └── utils/          # Shared utilities
│   └── package.json
├── docker-compose.yml      # Docker services
├── .env.example           # Environment variables template
└── package.json           # Root workspace config
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (jika tidak menggunakan Docker)
- Redis (jika tidak menggunakan Docker)

### 1. Clone Repository
```bash
git clone <repository-url>
cd teleweb
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env file dengan konfigurasi yang sesuai
```

### 3. Install Dependencies
```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm run install:all
```

### 4. Database Setup
```bash
# Start database services
docker-compose up -d postgres redis

# Generate Prisma client
cd backend
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

### 5. Start Development
```bash
# Start all services in development mode
npm run dev

# Atau start individual services:
npm run dev:backend    # Backend API (port 3001)
npm run dev:frontend   # Frontend (port 3000)
npm run dev:bot        # Telegram Bot
```

## 🤖 Bot Features

### Mode-based Processing
Bot menggunakan sistem mode untuk memproses berbagai jenis file:

1. **OCR Mode** - Ekstraksi teks dari gambar
2. **Geotags Mode** - Ekstraksi koordinat GPS dari foto
3. **Archive Mode** - Ekstraksi dan analisis file arsip
4. **Workbook Mode** - Konversi dan analisis spreadsheet
5. **KML Mode** - Ekstraksi data dari file KML/KMZ
6. **Location Mode** - Pemrosesan data koordinat

### User Management
- Admin-managed user registration
- Feature-based access control
- Role-based permissions (ADMIN/USER)
- Session tracking dan logging

### File Processing
- Support multiple file formats
- File size validation
- Automatic cleanup
- Metadata storage

## 🌐 Web Interface

### Dashboard
- Overview statistik sistem
- Real-time bot activity
- User dan file metrics

### User Management
- CRUD operations untuk users
- Feature assignment
- Role management
- Activity monitoring

### File Management
- File upload history
- Processing results
- Download processed files
- File metadata

### Activity Logs
- Bot interaction logs
- User activity tracking
- Error monitoring
- Performance metrics

## 🔐 Authentication & Authorization

### Telegram ID Based Auth
- Primary identifier: Telegram ID (string)
- Admin-managed registration
- JWT token authentication untuk web
- Feature-based access control

### Security Features
- Input validation dengan Zod
- Rate limiting
- CORS configuration
- Environment-based secrets

## 📊 Database Schema

### Core Tables
- `users` - User information dan permissions
- `features` - Available bot features
- `user_features` - User-feature relationships
- `files` - File metadata dan processing info
- `bot_activities` - Bot interaction logs
- `bot_sessions` - User session tracking

## 🚀 Deployment

### Production Setup
```bash
# Build all services
npm run build

# Start with PM2
npm run start:prod

# Atau menggunakan Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables
Lihat `.env.example` untuk daftar lengkap environment variables yang diperlukan.

## 📝 Development Guidelines

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- Feature-based organization

### Testing
```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov
```

### Logging
- Structured logging dengan Winston
- Correlation IDs untuk tracking
- Different log levels per environment
- Daily log rotation

## 🏗️ VPS Migration Guide

### Ketika Mengganti VPS, Update Konfigurasi Berikut:

#### 1. Environment Variables (.env)
```bash
# Update IP public VPS yang baru
PUBLIC_IP=NEW_VPS_IP_ADDRESS

# Update server host configuration
SERVER_HOST=0.0.0.0

# Update CORS origin jika perlu
CORS_ORIGIN=http://NEW_VPS_IP_ADDRESS:3000

# Update Telegram Bot API jika menggunakan local server
BOT_API_SERVER=http://localhost:8081
```

#### 2. Frontend Configuration (teleweb/frontend/vite.config.ts)
```typescript
// Update proxy target di vite config
proxy: {
  '/api': {
    target: 'http://NEW_VPS_IP_ADDRESS:3001',
    changeOrigin: true,
  },
}
```

#### 3. Backend Configuration (teleweb/backend/src/main.ts)
Backend sudah dikonfigurasi untuk membaca SERVER_HOST dari environment, tapi pastikan:
```typescript
// Di main.ts sudah ada:
const host = configService.get('SERVER_HOST', '0.0.0.0');
await app.listen(port, host);
```

#### 4. Bot Configuration (jika ada hardcoded URLs)
Check file bot configuration untuk referensi IP lama dan update ke IP baru.

#### 5. Database & Redis
Jika menggunakan external database/Redis server, update connection strings:
```bash
DATABASE_URL=postgresql://user:password@NEW_DB_HOST:5432/teleweb
REDIS_URL=redis://NEW_REDIS_HOST:6379
```

#### 6. Firewall & Security
Pastikan ports yang diperlukan terbuka di VPS baru:
- Port 3000 (Frontend)
- Port 3001 (Backend API)
- Port 5432 (PostgreSQL, jika external)
- Port 6379 (Redis, jika external)
- Port 8081 (Bot API Server, jika local)

#### 7. DNS & Domain (jika menggunakan custom domain)
Update DNS records untuk point ke IP VPS yang baru.

#### 8. SSL Certificates (jika menggunakan HTTPS)
Setup ulang SSL certificates untuk IP/domain yang baru.

### Checklist VPS Migration:
- [ ] Update PUBLIC_IP di .env
- [ ] Update Vite proxy target
- [ ] Restart backend dengan host 0.0.0.0
- [ ] Restart frontend development server
- [ ] Test API connectivity dengan curl
- [ ] Test frontend login functionality
- [ ] Test bot webhook/polling connection
- [ ] Verify file management download/delete works
- [ ] Update firewall rules
- [ ] Update monitoring scripts

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL service status
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **Bot Not Responding**
   - Verify BOT_TOKEN is correct
   - Check bot API server status
   - Review bot logs for errors

3. **Frontend Build Errors**
   - Clear node_modules dan reinstall
   - Check TypeScript errors
   - Verify path aliases

4. **Network Error saat Login**
   - Check PUBLIC_IP di .env sudah benar
   - Pastikan backend listen di 0.0.0.0 bukan localhost
   - Update Vite proxy target di vite.config.ts
   - Restart frontend development server setelah ubah .env

5. **Download/Delete File Tidak Bekerja**
   - Pastikan API base URL sudah benar
   - Check CORS configuration di backend
   - Verify file permissions di VPS

## 📚 API Documentation

API documentation tersedia di:
- Development: http://localhost:3001/api/docs
- Production: https://your-domain.com/api/docs

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

Untuk pertanyaan atau dukungan, hubungi:
- Email: your-email@domain.com
- Telegram: @your-username

---

**TeleWeb** - Bridging Telegram Bot and Web Application for seamless file processing and management.
