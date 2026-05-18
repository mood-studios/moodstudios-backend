# Mood Studios — Photography Booking API

Production-ready REST API for photography booking, client management, payments, gallery, real-time chat, and notifications.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT + bcrypt
- Socket.IO (real-time chat)
- Cloudinary (image uploads)
- PayMongo (payments)
- FCM-ready notifications

## Quick Start

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run seed        # first-time sample data
npm run dev
```

### Seed database (testing)

| Command | Description |
|---------|-------------|
| `npm run seed` | Adds sample data only if the database is empty |
| `npm run seed:fresh` | Clears all collections and reseeds |

**Test logins** (after seed):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@moodstudios.test` | `Admin123!` |
| Customer | `customer@moodstudios.test` | `Customer123!` |

Sample data includes **3 categories** and **12 official packages** (Self-Portrait Digital, Pro, and Photographer Session).

To refresh only services on an existing database (keeps users):

```bash
npm run seed:services
```

Server: `http://localhost:5000`  
Health check: `GET /api/health`

## Environment Variables

See `.env.example` for all variables. Required for core features:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `CLIENT_URL` | React Native app origin (CORS) |
| `ADMIN_URL` | Admin panel origin (CORS) |

Optional integrations:

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_*` | Gallery image uploads |
| `PAYMONGO_SECRET_KEY` | Payment intents & webhooks |
| `FCM_SERVER_KEY` | Push notifications |

Set `ALLOW_ADMIN_REGISTER=true` temporarily to create the first admin via `POST /api/auth/register` with `"role": "admin"`.

## API Overview

Base URL: `/api`

### Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register customer (or admin if allowed) |
| POST | `/auth/login` | Public | Login, returns JWT |
| POST | `/auth/verify-otp` | Public | Verify email OTP |
| POST | `/auth/resend-otp` | Public | Resend OTP (mocked in dev) |

### Users

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/users/profile` | Auth | Get profile |
| PUT | `/users/profile` | Auth | Update profile / FCM token |
| GET | `/users` | Admin | List all users |
| GET | `/users/customers` | Admin | List customers |

### Categories & Services

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/categories` | Public | List categories |
| POST | `/categories` | Admin | Create category |
| GET | `/services` | Public | List visible services |
| POST | `/services` | Admin | Create service |
| PATCH | `/services/:id/visibility` | Admin | Toggle visibility |

Filter services: `GET /services?category=<categoryId>`

### Bookings

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/bookings` | Customer | Create booking (cart of services) |
| GET | `/bookings/my` | Customer | My bookings |
| GET | `/bookings` | Admin | All bookings |
| PATCH | `/bookings/:id/status` | Admin | confirm / decline / complete |

**Create booking body:**

```json
{
  "services": ["<serviceId>", "<serviceId>"],
  "bookingDate": "2026-06-15T00:00:00.000Z",
  "bookingTime": "10:00 AM",
  "specialRequest": "Outdoor shoot preferred"
}
```

### Payments (PayMongo)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/payments` | Auth | Create payment intent |
| POST | `/payments/:id/confirm` | Auth | Confirm payment |
| POST | `/payments/webhook` | PayMongo | Webhook handler |

Without PayMongo keys, dev mode returns mock payment intent IDs.

### Gallery (Cloudinary)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/gallery` | Admin | Create album for booking |
| POST | `/gallery/:id/photos` | Admin | Upload images (`multipart/form-data`, field: `photos`) |
| GET | `/gallery/booking/:bookingId` | Auth | View albums for booking |

### Chat

**REST**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/history?receiverId=&bookingId=` | Chat history |
| GET | `/chat/conversations` | Recent conversations |

**Socket.IO** (connect with `auth: { token: '<JWT>' }`)

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ receiverId, bookingId? }` | Join chat room |
| `send_message` | `{ receiverId, message, bookingId? }` | Send message |
| `receive_message` | — | Incoming message |
| `typing` | `{ receiverId, isTyping }` | Typing indicator |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/:id/read` | Mark as read |

Notifications are created automatically for booking updates, payments, and new chat messages.

## Auth Header

```
Authorization: Bearer <token>
```

## Project Structure

```
backend/
├── config/          # DB, Cloudinary, PayMongo, FCM
├── controllers/
├── middleware/      # Auth, RBAC, validation, errors
├── models/
├── routes/
├── services/        # Email, payments, cloudinary, notifications
├── sockets/         # Socket.IO chat
├── utils/
├── validators/
├── uploads/
└── server.js
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production start |
| `npm run dev` | Development with nodemon |

## Security

- Helmet security headers
- Rate limiting (200 req / 15 min per IP)
- Password hashing (bcrypt, cost 12)
- JWT authentication
- Role-based authorization
- Input validation (express-validator)

## License

Private — Mood Studios
