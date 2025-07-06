# Norko GraphQL API - Railway Deployment

## Environment Variables Required

Set these in your Railway project dashboard:

```
NODE_ENV=production
PORT=4000
API_KEY=your-secure-api-key-here
JWT_SECRET=your-jwt-secret-minimum-32-characters
AUTH_REQUIRED=true
```

## Deployment Commands

The API will start automatically using:
```
npm start
```

## Health Check

The API provides several endpoints for health monitoring:
- `/health` - Basic health check
- `/graphql` - GraphQL endpoint
- `/playground` - GraphQL playground (if enabled)

## Security Notes

- Authentication is enabled in production
- Rate limiting is configured for 100 requests per 15 minutes per IP
- CORS is configured for production domains
