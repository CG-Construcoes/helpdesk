<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Performance Optimizations Applied

## Database Optimizations
- Added composite indexes to schema.prisma for frequent queries:
  - `@@index([status, deletedAt])` - for filtering by status and soft deletes
  - `@@index([technicianId, status])` - for technician assignments by status
  - `@@index([serviceId, status])` - for service filtering by status
  - `@@index([sectorId, status])` - for sector filtering by status
  - `@@index([ticketDate, status])` - for date-based queries with status
  - `@@index([ticketMonthYear, status])` - for monthly reports with status
  - `@@index([parentId, deletedAt])` - for hierarchical ticket queries
  - `@@index([requesterId, deletedAt])` - for requester filtering
  - `@@index([ticketDate, deletedAt])` - for date-based soft delete queries
  - `@@index([role, isActive])` - for active user filtering
  - `@@index([isActive, deletedAt])` - for active sector filtering

## Dashboard Service Optimizations
- Replaced in-memory processing with Prisma aggregations in `services/dashboard/dashboard.service.ts`
- Used `groupBy` for counting by status, technician, sector, service, and origin
- Used `aggregate` for average time calculations
- Used raw SQL queries for complex time series data (by day, week, month)
- Used raw SQL for top technicians with completion data
- Used raw SQL for services by sector grouping
- This reduces memory usage and leverages database query optimization

## Ticket Query Optimizations
- Added `userEmail` parameter to `TicketFilterOptions` in `services/ticket/query-tickets.service.ts`
- Modified API route to pass session email to avoid extra database query for requesters
- Optimized SLA risk filtering using raw SQL query instead of in-memory processing
- This reduces database round-trips for frequently used filters

## API Caching
- Added `unstable_cache` to dashboard stats endpoint with 30-second revalidation
- Added conditional caching to tickets list endpoint (5-second cache for simple queries)
- Added cache tags for invalidation when needed
- This reduces database load for frequently accessed data

## Next.js Configuration
- Enabled compression in `next.config.ts`
- Enabled SWC minification
- Optimized package imports for icon libraries
- Configured output as standalone for better deployment
- Added AVIF/WebP image format support
